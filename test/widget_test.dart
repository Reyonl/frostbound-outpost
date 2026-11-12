import 'package:flutter_test/flutter_test.dart';
import 'package:frostbound_outpost/main.dart';

void main() {
  test('normalizeWebAssetPath maps root and prevents traversal', () {
    expect(normalizeWebAssetPath('/'), 'assets/web/index.html');
    expect(normalizeWebAssetPath(''), 'assets/web/index.html');
    expect(normalizeWebAssetPath('/assets/index.js?v=1'), 'assets/web/assets/index.js');
    expect(normalizeWebAssetPath('/../secret.txt'), 'assets/web/secret.txt');
  });

  test('contentTypeForAsset returns correct MIME types', () {
    expect(contentTypeForAsset('index.html').mimeType, 'text/html');
    expect(contentTypeForAsset('assets/main.js').mimeType, 'application/javascript');
    expect(contentTypeForAsset('assets/style.css').mimeType, 'text/css');
  });

  testWidgets('FrostboundApp renders splash overlay when WebView disabled in test', (tester) async {
    await tester.pumpWidget(const FrostboundApp(enableWebView: false));
    expect(find.text('FROSTBOUND OUTPOST'), findsOneWidget);
  });
}
