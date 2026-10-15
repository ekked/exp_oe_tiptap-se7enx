<?php
/**
 * Empty paragraphs stay what they are, however often a text goes through Tiptap: stored ezxml -> eZOEXMLInput::inputXML()
 * -> Tiptap (tests/js/schema/through-tiptap.mjs, node) -> eZOEInputParser as eZOEXMLInput::validateInput() runs it
 * -> ezxml, three times. Before, every pass added the empty paragraph inputXML() appends for TinyMCE's cursor and
 * the empty paragraphs the browser makes around <p><table>...</table></p>; this checks both the stored ezxml and the
 * HTML Tiptap posts.
 *
 * Needs node and the extension's node_modules (npm ci); skipped without them. No database: the fixtures have no
 * links or embeds.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/roundtrip/expoetiptaproundtrip.php';

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class EmptyParagraphRoundtripTest extends TestCase
{
    const SECTION = '<?xml version="1.0" encoding="utf-8"?>' . "\n" .
        '<section xmlns:image="http://ez.no/namespaces/ezpublish3/image/" xmlns:xhtml="http://ez.no/namespaces/ezpublish3/xhtml/" ' .
        'xmlns:custom="http://ez.no/namespaces/ezpublish3/custom/">%s</section>' . "\n";

    const TABLE = '<table border="1" width="100%%"><tr><td><paragraph>%s</paragraph></td></tr></table>';

    public static function documents()
    {
        return array(
            'paragraph alone' => array( '<paragraph>Kurzfassung E2E.</paragraph>' ),
            'table at the end' => array( '<paragraph>Before.</paragraph><paragraph>' . sprintf( self::TABLE, 'cell' ) . '</paragraph>' ),
            'table in the middle' => array( '<paragraph>Before.</paragraph><paragraph>' . sprintf( self::TABLE, 'cell' ) .
                                            '</paragraph><paragraph>After.</paragraph>' ),
            'table alone' => array( '<paragraph>' . sprintf( self::TABLE, 'cell' ) . '</paragraph>' ),
            'two tables' => array( '<paragraph>' . sprintf( self::TABLE, 'one' ) . '</paragraph><paragraph>' . sprintf( self::TABLE, 'two' ) . '</paragraph>' ),
            'lines' => array( '<paragraph><line>first line</line><line>second line</line></paragraph><paragraph>Next.</paragraph>' ),
            'table after a list' => array( '<paragraph><ul><li><paragraph>item</paragraph></li></ul></paragraph><paragraph>' .
                                           sprintf( self::TABLE, 'cell' ) . '</paragraph>' ),
            'list after a table' => array( '<paragraph>' . sprintf( self::TABLE, 'cell' ) . '</paragraph>' .
                                           '<paragraph><ul><li><paragraph>item</paragraph></li></ul></paragraph>' ),
            'heading, table in a cell' => array( '<section><header>Head</header><paragraph>Text.</paragraph><paragraph>' .
                                                 sprintf( self::TABLE, 'outer</paragraph><paragraph>' . sprintf( self::TABLE, 'inner' ) ) .
                                                 '</paragraph></section>' ),
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

    /** The editor HTML through Tiptap (parse and post), as the browser does it */
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

    #[DataProvider( 'documents' )]
    public function testThreePassesThroughTiptapChangeNothing( $body )
    {
        $extension = self::node();
        if ( $extension === null )
            $this->markTestSkipped( 'node or the node_modules of exp_oe_tiptap are missing (npm ci)' );

        $original = sprintf( self::SECTION, $body );
        $xml = $original;
        $posted = array();
        for ( $pass = 1; $pass <= 3; $pass++ )
        {
            $html = expOETiptapRoundtrip::xmlToEditorHTML( $xml );
            $posted[$pass] = self::throughTiptap( $extension, $html );
            $xml = expOETiptapRoundtrip::editorHTMLToXML( $posted[$pass], $messages );
            $this->assertSame( array(), (array) $messages, "pass $pass: parser messages" );
            $compare = expOETiptapRoundtrip::compare( $original, $xml );
            $this->assertSame( 'identical', $compare['result'], "pass $pass: " . $compare['detail'] );

            $this->assertDoesNotMatchRegularExpression( '#<p><br></p>$#', $posted[$pass], "pass $pass: no empty last paragraph is posted" );
            $this->assertDoesNotMatchRegularExpression( '#<p><br></p><table|</table><p><br></p>#', $posted[$pass],
                                                        "pass $pass: no empty paragraph around a table is posted" );
            $this->assertStringNotContainsString( '<p></p>', $posted[$pass], "pass $pass" );
        }
        $this->assertSame( $posted[1], $posted[2], 'the second pass posts what the first did' );
        $this->assertSame( $posted[1], $posted[3], 'the third pass posts what the first did' );
    }

    public function testTheParserStillDropsAnEmptyLastParagraphOfTinyMCE()
    {
        // what ezoe's TinyMCE posts: the same ezxml as Tiptap's post without the empty paragraph
        $tinymce = expOETiptapRoundtrip::editorHTMLToXML( '<p>Kurzfassung E2E.</p><p><br></p>' );
        $tiptap = expOETiptapRoundtrip::editorHTMLToXML( '<p>Kurzfassung E2E.</p>' );
        $this->assertSame( expOETiptapRoundtrip::strictForm( $tinymce ), expOETiptapRoundtrip::strictForm( $tiptap ) );
    }
}
