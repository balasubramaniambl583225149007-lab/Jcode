package com.jcode.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;
    private Button btnHost;
    private Button btnReload;
    private SharedPreferences prefs;

    private static final String PREF_NAME = "jcode_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String DEFAULT_LOCAL_URL = "http://localhost:3000";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        btnHost = findViewById(R.id.btnHost);
        btnReload = findViewById(R.id.btnReload);

        setupWebView();

        btnHost.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showHostDialog();
            }
        });

        btnReload.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                webView.reload();
            }
        });

        String currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_LOCAL_URL);
        updateHostButtonLabel(currentUrl);
        loadTargetUrl(currentUrl);
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("jcode")
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface dialog, int which) {
                                result.confirm();
                            }
                        })
                        .setCancelable(false)
                        .create()
                        .show();
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                    String failedUrl = request.getUrl().toString();
                    showConnectionError(failedUrl);
                }
            }
        });
    }

    private void loadTargetUrl(String url) {
        webView.loadUrl(url);
    }

    private void updateHostButtonLabel(String url) {
        if (url.contains("localhost") || url.contains("127.0.0.1")) {
            btnHost.setText("Host: Localhost");
        } else if (url.startsWith("file:")) {
            btnHost.setText("Host: Offline");
        } else {
            btnHost.setText("Host: Cloud");
        }
    }

    private void showHostDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Connect to jcode Server");

        final String currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_LOCAL_URL);

        final EditText input = new EditText(this);
        input.setHint("e.g. http://localhost:3000 or Cloud URL");
        input.setText(currentUrl);
        input.setPadding(32, 24, 32, 24);
        builder.setView(input);

        builder.setPositiveButton("Connect", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String newUrl = input.getText().toString().trim();
                if (!newUrl.isEmpty()) {
                    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://") && !newUrl.startsWith("file://")) {
                        newUrl = "http://" + newUrl;
                    }
                    prefs.edit().putString(KEY_SERVER_URL, newUrl).apply();
                    updateHostButtonLabel(newUrl);
                    loadTargetUrl(newUrl);
                    Toast.makeText(MainActivity.this, "Connecting to " + newUrl, Toast.LENGTH_SHORT).show();
                }
            }
        });

        builder.setNeutralButton("Offline Bundle", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String offlineUrl = "file:///android_asset/www/index.html";
                prefs.edit().putString(KEY_SERVER_URL, offlineUrl).apply();
                updateHostButtonLabel(offlineUrl);
                loadTargetUrl(offlineUrl);
            }
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void showConnectionError(String failedUrl) {
        String msg = "Unable to connect to " + failedUrl + ".\n\n"
                + "If running on your phone via PocketDev, make sure 'npm start' is running in the background!\n\n"
                + "Would you like to switch server host or load the offline client interface?";

        new AlertDialog.Builder(this)
                .setTitle("Connection Error")
                .setMessage(msg)
                .setPositiveButton("Change Server", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        showHostDialog();
                    }
                })
                .setNegativeButton("Retry", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        webView.reload();
                    }
                })
                .show();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
