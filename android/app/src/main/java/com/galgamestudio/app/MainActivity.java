package com.galgamestudio.app;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Comparator;

/**
 * Galgame Studio 的 Android 外壳。
 *
 * 设计要点：
 *   1. 用 WebViewAssetLoader 以 https://appassets.androidplatform.net/ 提供页面，
 *      这样 IndexedDB / localStorage / canvas 都按正常 origin 工作（file:// 下会被浏览器禁用，
 *      立绘自动抠图正是靠 canvas 读像素）。
 *   2. 编辑器是「单文件 HTML」，全部资源内联，App 离线可用。
 *   3. 导出走 JS Bridge：网页把文件分块传过来，这边流式写入
 *      「应用内部书架」+「手机的 下载/GalgameStudio 目录」，用户能直接拿到文件。
 */
public class MainActivity extends AppCompatActivity {

    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri pendingCaptureUri;

    // 导出时的流式写入状态
    private FileOutputStream shelfStream;
    private File shelfFile;
    private ByteArrayOutputStream publicBuffer;
    private String pendingName = "export.html";
    private String pendingMime = "text/plain";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0D1411);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setTextZoom(100);              // 不跟随系统字体缩放，避免布局被撑坏
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/bookshelf/", new WebViewAssetLoader.InternalStoragePathHandler(
                        this, new File(getFilesDir(), "bookshelf")))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.endsWith("androidplatform.net")) return false;   // 应用内部导航
                String scheme = uri.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) { /* 没有可处理的 App */ }
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) showFatal("页面加载失败：" + error.getDescription());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent content = params.createIntent();
                    content.addCategory(Intent.CATEGORY_OPENABLE);
                    Intent chooser = Intent.createChooser(content, "选择素材");
                    Intent capture = buildCaptureIntent();
                    if (capture != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{capture});
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    filePathCallback = null;
                    toast("打不开文件选择器：" + error.getMessage());
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new Bridge(), "GalBridge");

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // 先让网页处理（关弹窗 / 退出阅读 / 收起抽屉），网页说没处理才退出应用
                webView.evaluateJavascript("(window.__galBack && window.__galBack()) === true", value -> {
                    if (!"true".equals(value)) {
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                        }
                    }
                });
            }
        });

        webView.loadUrl(APP_ORIGIN + "/assets/www/index.html");
    }

    /** 拍照输出到 cache/captures，经 FileProvider 授权给相机 App */
    private Intent buildCaptureIntent() {
        try {
            File dir = new File(getCacheDir(), "captures");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File photo = new File(dir, "shot_" + System.currentTimeMillis() + ".jpg");
            pendingCaptureUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photo);
            Intent capture = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            capture.putExtra(MediaStore.EXTRA_OUTPUT, pendingCaptureUri);
            capture.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return capture;
        } catch (Exception error) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (pendingCaptureUri != null) {
                result = new Uri[]{pendingCaptureUri};   // 刚拍的照片
            }
        }
        pendingCaptureUri = null;
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void toast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }

    private void showFatal(String message) {
        runOnUiThread(() -> {
            TextView view = new TextView(this);
            view.setText(message);
            view.setTextColor(0xFFF2B9B0);
            view.setBackgroundColor(0xFF1E0E0C);
            view.setPadding(36, 48, 36, 48);
            view.setTextSize(14);
            setContentView(view);
        });
    }

    private String sanitizeName(String name) {
        String clean = name == null ? "export.html" : name.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "_").trim();
        if (clean.isEmpty()) clean = "export.html";
        if (clean.length() > 70) clean = clean.substring(clean.length() - 70);
        return clean;
    }

    private void closeSaveStream() {
        if (shelfStream != null) {
            try { shelfStream.flush(); shelfStream.close(); } catch (Exception ignored) { }
            shelfStream = null;
        }
    }

    /* ------------------------------------------------------------------ 桥 */

    private class Bridge {

        @JavascriptInterface
        public boolean isAndroid() {
            return true;
        }

        @JavascriptInterface
        public void toast(String message) {
            MainActivity.this.toast(message);
        }

        /** 开始接收一个文件（内容由 appendChunk 分块送达，每块是 4 的倍数的 base64） */
        @JavascriptInterface
        public String beginSaveFile(String name, String mime) {
            closeSaveStream();
            try {
                pendingName = sanitizeName(name);
                pendingMime = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
                File dir = new File(getFilesDir(), "bookshelf");
                if (!dir.exists() && !dir.mkdirs()) return "error: 无法创建书架目录";
                shelfFile = new File(dir, pendingName);
                shelfStream = new FileOutputStream(shelfFile);
                publicBuffer = new ByteArrayOutputStream();
                return "ok";
            } catch (Exception error) {
                return "error: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String appendChunk(String chunkBase64) {
            if (shelfStream == null) return "error: 还没有开始保存";
            try {
                byte[] bytes = Base64.decode(chunkBase64, Base64.NO_WRAP);
                shelfStream.write(bytes);
                if (publicBuffer != null) publicBuffer.write(bytes);
                return "ok";
            } catch (Exception error) {
                return "error: " + error.getMessage();
            }
        }

        /** 收尾：写进手机的「下载/GalgameStudio」，返回给用户看的路径 */
        @JavascriptInterface
        public String endSaveFile() {
            if (shelfStream == null) return "保存失败：没有开始保存";
            long size = shelfFile == null ? 0 : shelfFile.length();
            try {
                closeSaveStream();
                byte[] bytes = publicBuffer == null ? new byte[0] : publicBuffer.toByteArray();
                publicBuffer = null;
                String publicPath = writeToDownloads(pendingName, pendingMime, bytes);
                if (publicPath != null) return publicPath;
                return "应用内书架（" + (size / 1024) + " KB）";
            } catch (Exception error) {
                return "保存失败：" + error.getMessage();
            }
        }

        @JavascriptInterface
        public String listBooks() {
            JSONArray array = new JSONArray();
            File dir = new File(getFilesDir(), "bookshelf");
            File[] files = dir.listFiles();
            if (files == null) return array.toString();
            Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
            for (File file : files) {
                if (!file.isFile()) continue;
                try {
                    JSONObject item = new JSONObject();
                    item.put("id", file.getName());
                    item.put("name", file.getName().replaceAll("(?i)\\.html?$", ""));
                    item.put("bytes", file.length());
                    item.put("savedAt", file.lastModified());
                    array.put(item);
                } catch (Exception ignored) { }
            }
            return array.toString();
        }

        @JavascriptInterface
        public String bookUrl(String id) {
            return APP_ORIGIN + "/bookshelf/" + Uri.encode(id);
        }

        @JavascriptInterface
        public String deleteBook(String id) {
            try {
                File file = new File(new File(getFilesDir(), "bookshelf"), id);
                return file.delete() ? "ok" : "删除失败";
            } catch (Exception error) {
                return "删除失败：" + error.getMessage();
            }
        }
    }

    /** 写一份到手机公共下载目录（Android 10+ 用 MediaStore，不需要任何权限） */
    private String writeToDownloads(String name, String mime, byte[] bytes) {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/GalgameStudio");
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return null;
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) return null;
                out.write(bytes);
                out.flush();
            }
            return "下载/GalgameStudio/" + name;
        } catch (Exception error) {
            return null;
        }
    }

    @Override
    protected void onDestroy() {
        closeSaveStream();
        if (webView != null) {
            webView.removeJavascriptInterface("GalBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
