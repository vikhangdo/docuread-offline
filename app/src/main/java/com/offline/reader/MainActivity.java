package com.offline.reader;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
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

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> filePickerLauncher;

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        initWebSettings();

        // Register file picker launcher for JavaScript bridge and WebChromeClient
        filePickerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri uri = result.getData().getData();
                    if (uri != null) {
                        // If file was requested via HTML <input type="file">
                        if (filePathCallback != null) {
                            filePathCallback.onReceiveValue(new Uri[]{uri});
                            filePathCallback = null;
                        }
                        // Also load directly into native bridge
                        loadDocumentFromUri(uri);
                    }
                } else {
                    if (filePathCallback != null) {
                        filePathCallback.onReceiveValue(null);
                        filePathCallback = null;
                    }
                }
            }
        );

        // Native JavaScript Interface
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        // Load local offline assets
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
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Handle pending intent if any
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
                String[] mimeTypes = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"};
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
            String fileName = getFileName(uri);
            String mimeType = getContentResolver().getType(uri);

            InputStream inputStream = getContentResolver().openInputStream(uri);
            if (inputStream == null) {
                Toast.makeText(this, "Không thể mở tệp tin!", Toast.LENGTH_SHORT).show();
                return;
            }

            ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream();
            int bufferSize = 16384;
            byte[] buffer = new byte[bufferSize];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                byteBuffer.write(buffer, 0, len);
            }
            byte[] rawBytes = byteBuffer.toByteArray();
            inputStream.close();

            String base64Data = Base64.encodeToString(rawBytes, Base64.NO_WRAP);

            // Pass base64 data to web reader engine
            String jsCode = String.format("window.openDocumentFromNative('%s', '%s', '%s');",
                    base64Data, escapeJsString(fileName), escapeJsString(mimeType != null ? mimeType : ""));

            runOnUiThread(() -> webView.evaluateJavascript(jsCode, null));

        } catch (Exception e) {
            e.printStackTrace();
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
                  .replace("\n", "\\n")
                  .replace("\r", "\\r");
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
            String[] mimeTypes = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"};
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            filePickerLauncher.launch(intent);
        }

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void onAppReady() {
            // Check if there was an intent to open
            handleIncomingIntent(getIntent());
        }
    }
}
