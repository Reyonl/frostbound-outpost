import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const FrostboundApp());
}

/// Resolves an HTTP request path to a bundled Flutter asset path under `assets/web/`.
String normalizeWebAssetPath(String requestPath) {
  var cleaned = requestPath.split('?').first.replaceAll('\\', '/');
  while (cleaned.startsWith('/')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.isEmpty) {
    cleaned = 'index.html';
  }
  final segments = cleaned.split('/').where((s) => s.isNotEmpty && s != '.' && s != '..');
  final normalized = segments.join('/');
  return normalized.isEmpty ? 'assets/web/index.html' : 'assets/web/$normalized';
}

/// Returns the Content-Type header value for bundled static game files.
ContentType contentTypeForAsset(String path) {
  final lower = path.toLowerCase();
  if (lower.endsWith('.html')) return ContentType('text', 'html', charset: 'utf-8');
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) {
    return ContentType('application', 'javascript', charset: 'utf-8');
  }
  if (lower.endsWith('.css')) return ContentType('text', 'css', charset: 'utf-8');
  if (lower.endsWith('.json')) return ContentType('application', 'json', charset: 'utf-8');
  if (lower.endsWith('.svg')) return ContentType('image', 'svg+xml');
  if (lower.endsWith('.png')) return ContentType('image', 'png');
  if (lower.endsWith('.webp')) return ContentType('image', 'webp');
  if (lower.endsWith('.wasm')) return ContentType('application', 'wasm');
  if (lower.endsWith('.woff2')) return ContentType('font', 'woff2');
  if (lower.endsWith('.woff')) return ContentType('font', 'woff');
  if (lower.endsWith('.ttf')) return ContentType('font', 'ttf');
  return ContentType.binary;
}

/// Serves bundled `assets/web/` files over loopback HTTP so ES modules, WebGL,
/// WebAudio, and persistent origin-scoped localStorage work offline on Android.
class LocalWebAssetServer {
  HttpServer? _server;

  int? get port => _server?.port;

  Future<Uri> start() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server = server;
    unawaited(_serveRequests(server));
    return Uri.parse('http://127.0.0.1:${server.port}/index.html');
  }

  Future<void> _serveRequests(HttpServer server) async {
    await for (final request in server) {
      final assetPath = normalizeWebAssetPath(request.uri.path);
      try {
        final ByteData data = await rootBundle.load(assetPath);
        request.response.statusCode = HttpStatus.ok;
        request.response.headers.contentType = contentTypeForAsset(assetPath);
        request.response.headers.set('Cache-Control', 'no-cache');
        request.response.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
      } catch (_) {
        request.response.statusCode = HttpStatus.notFound;
        request.response.write('Not found: $assetPath');
      } finally {
        await request.response.close();
      }
    }
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
  }
}

class FrostboundApp extends StatelessWidget {
  const FrostboundApp({super.key, this.enableWebView = true});

  final bool enableWebView;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Frostbound Outpost',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A192F),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0EA5E9),
          brightness: Brightness.dark,
        ),
      ),
      home: FrostboundGameScreen(enableWebView: enableWebView),
    );
  }
}

class FrostboundGameScreen extends StatefulWidget {
  const FrostboundGameScreen({super.key, this.enableWebView = true});

  final bool enableWebView;

  @override
  State<FrostboundGameScreen> createState() => _FrostboundGameScreenState();
}

class _FrostboundGameScreenState extends State<FrostboundGameScreen> with WidgetsBindingObserver {
  final LocalWebAssetServer _assetServer = LocalWebAssetServer();
  WebViewController? _controller;
  bool _isReady = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.enableWebView) {
      unawaited(_bootstrapGame());
    }
  }

  Future<void> _bootstrapGame() async {
    try {
      final gameUri = await _assetServer.start();
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF0A192F))
        ..addJavaScriptChannel('FrostboundNative', onMessageReceived: _handleNativeMessage)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) {
              if (mounted) {
                setState(() => _isReady = true);
              }
            },
            onWebResourceError: (error) {
              if (error.isForMainFrame == true && mounted) {
                setState(() => _errorMessage = error.description);
              }
            },
          ),
        );

      final platformController = controller.platform;
      if (platformController is AndroidWebViewController) {
        await platformController.setMediaPlaybackRequiresUserGesture(false);
      }

      await controller.loadRequest(gameUri);
      if (mounted) {
        setState(() => _controller = controller);
      }
    } catch (err) {
      if (mounted) {
        setState(() => _errorMessage = err.toString());
      }
    }
  }

  void _handleNativeMessage(JavaScriptMessage message) {
    switch (message.message) {
      case 'haptic:light':
        HapticFeedback.lightImpact();
      case 'haptic:medium':
        HapticFeedback.mediumImpact();
      case 'haptic:heavy':
        HapticFeedback.heavyImpact();
      case 'haptic:selection':
        HapticFeedback.selectionClick();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null) return;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      unawaited(controller.runJavaScript('window.FrostboundLifecycle?.onPause?.();'));
    } else if (state == AppLifecycleState.resumed) {
      unawaited(controller.runJavaScript('window.FrostboundLifecycle?.onResume?.();'));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_assetServer.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A192F),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_controller != null) WebViewWidget(controller: _controller!),
          if (!_isReady) _buildSplashOverlay(),
        ],
      ),
    );
  }

  Widget _buildSplashOverlay() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0A192F), Color(0xFF123C69), Color(0xFF0F172A)],
        ),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: Image.asset('assets/icon/app_icon.png', width: 96, height: 96),
              ),
              const SizedBox(height: 20),
              const Text(
                'FROSTBOUND OUTPOST',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.6,
                  color: Color(0xFFF8FAFC),
                ),
              ),
              const SizedBox(height: 16),
              if (_errorMessage != null)
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 13),
                )
              else
                const SizedBox(
                  width: 140,
                  child: LinearProgressIndicator(
                    minHeight: 5,
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                    color: Color(0xFF38BDF8),
                    backgroundColor: Color(0xFF1E293B),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
