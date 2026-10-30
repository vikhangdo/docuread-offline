package com.offline.reader;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Arrays;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "DocuRead";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> filePickerLauncher;

    private byte[] currentFileBytes = null;
    private String currentFileName = "";
    private String currentMimeType = "";

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        initWebSettings();

        // Register file picker launcher
        filePickerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri uri = result.getData().getData();
                    if (uri != null) {
                        loadDocumentFromUri(uri);
                    }
                }
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }
            }
        );

        // Native JavaScript Interface
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        // Load local offline assets directly
        webView.loadUrl("file:///android_asset/index.html");

        // Handle intent if launched by clicking a PDF or DOCX file from file manager
        handleIncomingIntent(getIntent());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setInitialScale(0); // Let viewport meta control initial scale

        webView.setScrollBarStyle(WebView.SCROLLBARS_OUTSIDE_OVERLAY);
        webView.setScrollbarFadingEnabled(true);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.setHorizontalScrollBarEnabled(true);
        webView.setVerticalScrollBarEnabled(true);
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                handleIncomingIntent(getIntent());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                              FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] mimeTypes = {
                    "application/pdf", 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                    "application/msword"
                };
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
                filePickerLauncher.launch(intent);
                return true;
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri data = intent.getData();

        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            loadDocumentFromUri(data);
        }
    }

    public void loadDocumentFromUri(Uri uri) {
        try {
            currentFileName = getFileName(uri);
            currentMimeType = getContentResolver().getType(uri);
            if (currentMimeType == null) currentMimeType = "";

            InputStream inputStream = getContentResolver().openInputStream(uri);
            if (inputStream == null) {
                Toast.makeText(this, "Không thể đọc tệp!", Toast.LENGTH_SHORT).show();
                return;
            }

            ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream();
            byte[] buffer = new byte[32768];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                byteBuffer.write(buffer, 0, len);
            }
            currentFileBytes = byteBuffer.toByteArray();
            inputStream.close();

            int totalSize = currentFileBytes.length;
            Log.d(TAG, "Loaded file " + currentFileName + ", size: " + totalSize);

            // Notify JavaScript that file is ready to pull via chunked bridge (avoids 1MB Binder crash)
            String jsCode = String.format("if (window.onNativeDocumentReady) { window.onNativeDocumentReady('%s', '%s', %d); }",
                    escapeJsString(currentFileName), escapeJsString(currentMimeType), totalSize);

            runOnUiThread(() -> webView.evaluateJavascript(jsCode, null));

        } catch (Exception e) {
            Log.e(TAG, "Error loading document", e);
            Toast.makeText(this, "Lỗi mở tệp: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private String getFileName(Uri uri) {
        String result = null;
        if ("content".equalsIgnoreCase(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex >= 0) {
                        result = cursor.getString(nameIndex);
                    }
                }
            } catch (Exception ignored) {}
        }
        if (result == null) {
            result = uri.getLastPathSegment();
        }
        return result != null ? result : "document";
    }

    private String escapeJsString(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("'", "\\'")
                  .replace("\"", "\\\"")
                  .replace("\n", " ")
                  .replace("\r", " ");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void pickFile() {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            String[] mimeTypes = {
                "application/pdf", 
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                "application/msword"
            };
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            filePickerLauncher.launch(intent);
        }

        @JavascriptInterface
        public int getFileSize() {
            return currentFileBytes != null ? currentFileBytes.length : 0;
        }

        @JavascriptInterface
        public String getFileName() {
            return currentFileName;
        }

        @JavascriptInterface
        public String getChunk(int offset, int length) {
            if (currentFileBytes == null || offset < 0 || offset >= currentFileBytes.length) {
                return "";
            }
            int end = Math.min(offset + length, currentFileBytes.length);
            byte[] chunk = Arrays.copyOfRange(currentFileBytes, offset, end);
            return Base64.encodeToString(chunk, Base64.NO_WRAP);
        }

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void onAppReady() {
            if (currentFileBytes != null && currentFileBytes.length > 0) {
                String jsCode = String.format("if (window.onNativeDocumentReady) { window.onNativeDocumentReady('%s', '%s', %d); }",
                        escapeJsString(currentFileName), escapeJsString(currentMimeType), currentFileBytes.length);
                runOnUiThread(() -> webView.evaluateJavascript(jsCode, null));
            } else {
                handleIncomingIntent(getIntent());
            }
        }
    }
}
