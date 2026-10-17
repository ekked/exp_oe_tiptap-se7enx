<?php
/**
 * The round trip of tests/php/roundtrip/run.sh for the synthetic fixtures that need no database (no links, no
 * embeds), here without a sandbox: fixture ezxml -> eZOEXMLInput::inputXML() (must still be the fixture's HTML) ->
 * Tiptap (tests/js/schema/through-tiptap.mjs, node) -> eZOEInputParser -> ezxml, compared with the original and with
 * ezoe alone (the fixture's HTML posted as it is).
 *
 *  - s067-math-custom-tags: the inline custom tags math_latex and math_mathml, inline and with custom:display="block",
 *    one inside bold; MathML in an attribute. Defined here in memory as a site defines them in content.ini.
 *  - s068-section-lists-headings: headings of nested sections, and lists directly under <section> (not in a
 *    paragraph). inputXML() drops such lists before any editor sees them: a known limitation both editors share.
 *    The test asserts parity: Tiptap loses nothing ezoe alone keeps, and the headings stay.
 *
 * Needs node and the extension's node_modules (npm ci); skipped without them.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/roundtrip/expoetiptaproundtrip.php';

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class FixtureParityTest extends TestCase
{
    /** @var array content.ini values before the test */
    private $saved = array();

    protected function setUp(): void
    {
        $ini = eZINI::instance( 'content.ini' );
        $tags = (array) $ini->variable( 'CustomTagSettings', 'AvailableCustomTags' );
        $inline = $ini->hasVariable( 'CustomTagSettings', 'IsInline' ) ? (array) $ini->variable( 'CustomTagSettings', 'IsInline' ) : array();
        $values = array(
            array( 'CustomTagSettings', 'AvailableCustomTags', array_values( array_unique( array_merge( $tags, array( 'math_latex', 'math_mathml' ) ) ) ) ),
            array( 'CustomTagSettings', 'IsInline', array_merge( $inline, array( 'math_latex' => 'true', 'math_mathml' => 'true' ) ) ),
            array( 'math_latex', 'CustomAttributes', array( 'display', 'alt' ) ),
            array( 'math_mathml', 'CustomAttributes', array( 'display', 'mathml' ) ),
        );
        foreach ( $values as list( $block, $name, $value ) )
        {
            $this->saved[] = array( $block, $name, $ini->hasVariable( $block, $name ) ? $ini->variable( $block, $name ) : null );
            $ini->setVariable( $block, $name, $value );
        }
        unset( $GLOBALS['eZXMLSchemaGlobalInstance'] );
    }

    protected function tearDown(): void
    {
        $ini = eZINI::instance( 'content.ini' );
        foreach ( array_reverse( $this->saved ) as $entry )
        {
            if ( $entry[2] === null )
                $ini->removeSetting( $entry[0], $entry[1] );
            else
                $ini->setVariable( $entry[0], $entry[1], $entry[2] );
        }
        $this->saved = array();
        unset( $GLOBALS['eZXMLSchemaGlobalInstance'] );
    }

    public static function fixtures()
    {
        return array(
            'math custom tags' => array( 's067-math-custom-tags', 'identical' ),
            'lists and headings directly under section' => array( 's068-section-lists-headings', 'lossy' ),
        );
    }

    private static function node()
    {
        $extension = dirname( __DIR__, 2 );
        if ( !is_dir( $extension . '/node_modules/happy-dom' ) )
            return null;
        $out = array();
        exec( 'node --version 2>/dev/null', $out, $status );
        return $status === 0 ? $extension : null;
    }

    private static function throughTiptap( $extension, $html )
    {
        $process = proc_open( array( 'node', 'tests/js/schema/through-tiptap.mjs' ),
                              array( 0 => array( 'pipe', 'r' ), 1 => array( 'pipe', 'w' ), 2 => array( 'pipe', 'w' ) ), $pipes, $extension );
        if ( !is_resource( $process ) )
            throw new RuntimeException( 'node did not start' );
        fwrite( $pipes[0], $html );
        fclose( $pipes[0] );
        $out = stream_get_contents( $pipes[1] );
        $error = stream_get_contents( $pipes[2] );
        fclose( $pipes[1] );
        fclose( $pipes[2] );
        if ( proc_close( $process ) !== 0 )
            throw new RuntimeException( 'through-tiptap.mjs failed: ' . $error );
        return $out;
    }

    #[DataProvider( 'fixtures' )]
    public function testTiptapLosesNothingEzoeAloneKeeps( $name, $ezoeVersusOriginal )
    {
        $extension = self::node();
        if ( $extension === null )
            $this->markTestSkipped( 'node or the node_modules of exp_oe_tiptap are missing (npm ci)' );
        $dir = EXP_OE_TIPTAP_TEST_EXTENSION . '/tests/fixtures/';
        $original = file_get_contents( $dir . $name . '.xml' );
        $fixtureHtml = file_get_contents( $dir . $name . '.html' );
        $this->assertSame( $fixtureHtml, expOETiptapRoundtrip::xmlToEditorHTML( $original ), 'the fixture HTML is what inputXML() makes of the ezxml' );

        $ezoeXml = expOETiptapRoundtrip::editorHTMLToXML( $fixtureHtml, $ezoeMessages );
        $tiptapXml = expOETiptapRoundtrip::editorHTMLToXML( self::throughTiptap( $extension, $fixtureHtml ), $tiptapMessages );
        $this->assertSame( array(), (array) $ezoeMessages );
        $this->assertSame( array(), (array) $tiptapMessages );

        $this->assertSame( $ezoeVersusOriginal, expOETiptapRoundtrip::compare( $original, $ezoeXml )['result'], 'ezoe alone vs the original' );
        $versus = expOETiptapRoundtrip::compare( $ezoeXml, $tiptapXml );
        $this->assertNotSame( 'lossy', $versus['result'], 'Tiptap vs ezoe alone: ' . $versus['detail'] );
        // nothing lost against the original either; "equal" allows the one change Tiptap makes: a mark around an inline
        // custom tag goes inside it (<strong><custom>x</custom></strong> becomes <custom><strong>x</strong></custom>)
        if ( $ezoeVersusOriginal === 'identical' )
            $this->assertContains( expOETiptapRoundtrip::compare( $original, $tiptapXml )['result'], array( 'identical', 'equal' ) );
    }

    public function testTheKnownLimitationIsWhatItSays()
    {
        $original = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/tests/fixtures/s068-section-lists-headings.xml' );
        $xml = expOETiptapRoundtrip::editorHTMLToXML( expOETiptapRoundtrip::xmlToEditorHTML( $original ) );
        // the headings and paragraphs of the nested sections stay, the lists directly under <section> are gone
        $this->assertStringContainsString( '<header>Heading one</header>', $xml );
        $this->assertStringContainsString( '<header>Heading two</header>', $xml );
        $this->assertStringContainsString( '<paragraph>Text.</paragraph>', $xml );
        $this->assertStringNotContainsString( '<ul>', $xml );
        $this->assertStringNotContainsString( '<ol>', $xml );
        // a list in a paragraph, the form both editors write, is kept (s060-lists)
    }
}
