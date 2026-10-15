<?php
/**
 * The source view (button code) cannot put a script into the stored text: whatever HTML a user types there, or posts
 * past the editor's own clean-up, the server makes the ezxmltext of it with eZOEInputParser, as for TinyMCE. Script
 * elements, event handler attributes, style and frames are not part of ezxmltext, and a link to a script address
 * (javascript:, a hidden javascript: with character references or white space, data:text/html) is refused: the
 * parser removes the address, says so and marks the input as invalid, so the draft is not stored.
 *
 * No database: none of the links below is registered (the refused ones lose their address before that), and there
 * are no embeds (the parser looks an embedded object up in the database).
 */

require_once __DIR__ . '/bootstrap.php';

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SourceViewServerValidationTest extends TestCase
{
    public static function payloads()
    {
        return array(
            'script element' => array( '<p>a<script>alert(1)</script>b</p><script>alert(2)</script>', true ),
            'event handlers and style' => array( '<p onclick="alert(1)" style="background:url(javascript:alert(1))">e<img src="x" onerror="alert(1)"></p>', true ),
            'handlers on a heading, a table cell and a list' => array( '<h2 onmouseover="alert(1)">t</h2><table onload="x()"><tbody><tr onclick="x()"><td onfocus="x()"><p>c</p></td></tr></tbody></table><ul onclick="x()"><li onclick="x()">l</li></ul>', true ),
            'frame and svg' => array( '<p><iframe src="javascript:alert(1)"></iframe>h<svg onload="alert(1)"><script>alert(3)</script></svg></p>', true ),
            'handler on an anchor link' => array( '<p><a href="#x" onclick="alert(1)" title="t&quot; onfocus=&quot;x">i</a></p>', true ),
            'javascript link' => array( '<p><a href="javascript:alert(1)">x</a></p>', false ),
            'hidden javascript link' => array( '<p><a href="JaVa&#9;ScRiPt:alert(1)">y</a></p>', false ),
            'character reference javascript link' => array( '<p><a href="&#106;avascript:alert(1)">y</a></p>', false ),
            'data link' => array( '<p><a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">z</a></p>', false ),
        );
    }

    #[DataProvider( 'payloads' )]
    public function testNoScriptReachesTheStoredText( $html, $valid )
    {
        $parser = new eZOEInputParser();
        $document = $parser->process( $html );
        $this->assertInstanceOf( DOMDocument::class, $document );
        $xml = eZXMLTextType::domString( $document );

        $this->assertStringNotContainsStringIgnoringCase( '<script', $xml );
        $this->assertStringNotContainsStringIgnoringCase( '<iframe', $xml );
        $this->assertStringNotContainsStringIgnoringCase( '<svg', $xml );
        $this->assertStringNotContainsStringIgnoringCase( 'javascript', $xml );
        $this->assertStringNotContainsStringIgnoringCase( 'data:text', $xml );
        $this->assertDoesNotMatchRegularExpression( '/\sstyle\s*=/i', $xml, 'no style attribute' );
        foreach ( $document->getElementsByTagName( '*' ) as $element )
        {
            foreach ( $element->attributes as $attribute )
                $this->assertDoesNotMatchRegularExpression( '/^on/i', $attribute->localName, $xml );
        }

        $this->assertSame( $valid, $parser->isValid(), 'only a refused script link marks the input as invalid' );
        if ( !$valid )
            $this->assertStringContainsString( 'Using scripts in links is not allowed', implode( ' ', $parser->getMessages() ) );
    }
}
