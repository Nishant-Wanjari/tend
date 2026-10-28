package app.tend.tracker;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Tend runs its web UI from the app's assets, with a small bridge for files and system bars. */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 4201;
    private WebView web;
    private ValueCallback<Uri[]> pendingPick;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.paper));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);

        web.addJavascriptInterface(new Bridge(), "TendNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equals(scheme)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingPick != null) pendingPick.onReceiveValue(null);
                pendingPick = callback;
                boolean image = false;
                for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image")) image = true;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(image ? "image/*" : "*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, image ? "Choose a cover" : "Choose a file"), PICK_FILE);
                } catch (ActivityNotFoundException e) {
                    pendingPick = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && pendingPick != null) {
            pendingPick.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingPick = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.tendBack && window.tendBack()) ? 'yes' : 'no'", result -> {
            if (result == null || !result.contains("yes")) exitApp();
        });
    }

    @SuppressWarnings("deprecation")
    private void exitApp() {
        super.onBackPressed();
    }

    private Uri insertMedia(String name, String mime) {
        ContentResolver cr = getContentResolver();
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri collection;
        if (mime.startsWith("image/")) {
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/Tend");
            collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        } else {
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Tend");
            collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        }
        return cr.insert(collection, v);
    }

    private static byte[] readAll(InputStream in, int limit) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);
            if (out.size() > limit) throw new Exception("Response too large");
        }
        return out.toByteArray();
    }

    /** Methods callable from JavaScript as window.TendNative.*. They run on a background thread. */
    private class Bridge {
        /**
         * GET an https URL off the main thread (book search and cover images) and answer through
         * window.__tendFetchDone(id, ok, payload). Images come back as data: URLs.
         */
        @JavascriptInterface
        public void fetch(String id, String url, boolean asImage) {
            new Thread(() -> {
                boolean ok = false;
                String payload;
                HttpURLConnection c = null;
                try {
                    if (!url.startsWith("https://")) throw new Exception("Only https is allowed");
                    String target = url;
                    int hops = 0;
                    while (true) {
                        c = (HttpURLConnection) new URL(target).openConnection();
                        c.setConnectTimeout(10000);
                        c.setReadTimeout(15000);
                        c.setInstanceFollowRedirects(false);
                        c.setRequestProperty("User-Agent", "Tend/1.0 (Android personal reading tracker)");
                        int code = c.getResponseCode();
                        if (code >= 300 && code < 400 && hops++ < 5) {
                            String loc = c.getHeaderField("Location");
                            c.disconnect();
                            if (loc == null) throw new Exception("Bad redirect");
                            target = new URL(new URL(target), loc).toString();
                            if (!target.startsWith("https://")) throw new Exception("Insecure redirect");
                            continue;
                        }
                        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
                        break;
                    }
                    byte[] body;
                    try (InputStream in = c.getInputStream()) {
                        body = readAll(in, 8 * 1024 * 1024);
                    }
                    if (asImage) {
                        String type = c.getContentType();
                        if (type == null || !type.startsWith("image/")) type = "image/jpeg";
                        int semi = type.indexOf(';');
                        if (semi > 0) type = type.substring(0, semi);
                        payload = "data:" + type + ";base64," + Base64.encodeToString(body, Base64.NO_WRAP);
                    } else {
                        payload = new String(body, StandardCharsets.UTF_8);
                    }
                    ok = true;
                } catch (Exception e) {
                    payload = e.getMessage() == null ? "Network error" : e.getMessage();
                } finally {
                    if (c != null) c.disconnect();
                }
                final String js = "window.__tendFetchDone&&window.__tendFetchDone(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(payload) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        @JavascriptInterface
        public String saveFile(String name, String base64, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                Uri uri = insertMedia(name, mime);
                if (uri == null) return "failed";
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) return "failed";
                    out.write(bytes);
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContentResolver().update(uri, done, null, null);
                return "ok";
            } catch (Exception e) {
                return "failed";
            }
        }

        @JavascriptInterface
        public String shareFile(String name, String base64, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                File dir = new File(getCacheDir(), "shared");
                if (!dir.exists() && !dir.mkdirs()) return "failed";
                File f = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(bytes);
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> {
                    try {
                        startActivity(Intent.createChooser(send, "Share your progress"));
                    } catch (ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "No app can share this", Toast.LENGTH_SHORT).show();
                    }
                });
                return "ok";
            } catch (Exception e) {
                return "failed";
            }
        }

        @JavascriptInterface
        public void setBars(String hex, boolean dark) {
            runOnUiThread(() -> {
                try {
                    int c = Color.parseColor(hex);
                    Window w = getWindow();
                    w.setStatusBarColor(c);
                    w.setNavigationBarColor(c);
                    web.setBackgroundColor(c);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        WindowInsetsController ic = w.getInsetsController();
                        if (ic != null) {
                            int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                            ic.setSystemBarsAppearance(dark ? 0 : light, light);
                        }
                    } else {
                        View d = w.getDecorView();
                        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        d.setSystemUiVisibility(dark ? 0 : flags);
                    }
                } catch (IllegalArgumentException ignored) { }
            });
        }
    }
}
