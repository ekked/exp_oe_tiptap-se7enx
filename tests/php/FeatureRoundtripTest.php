<?php
/**
 * What the editor's dialogs and commands of 0.1.4 write is stored without loss and comes back unchanged: tag
 * properties (class and custom attributes of paragraph, header, li, strong), table row properties, the cell dialog's
 * "Apply to" (column, row with a new cell type, the whole table) and the non-breaking space.
 *
 * Each case: stored ezxml -> eZOEXMLInput::inputXML() -> the editor with one edit made by its dialog
 * (tests/js/schema/through-editor.mjs, node) -> eZOEInputParser as eZOEXMLInput::validateInput() runs it -> ezxml,
 * which must be the expected ezxml; then two more passes without an edit (through-tiptap.mjs) change nothing.
 * content.ini gets the classes and custom attributes the dialogs offer (as a site defines them), in memory only.
 *
 * Needs node and the extension's node_modules (npm ci); skipped without them. No database: no links or embeds.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/roundtrip/expoetiptaproundtrip.php';

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class FeatureRoundtripTest extends TestCase
{
    const SECTION = '<?xml version="1.0" encoding="utf-8"?>' . "\n" .
        '<section xmlns:image="http://ez.no/namespaces/ezpublish3/image/" xmlns:xhtml="http://ez.no/namespaces/ezpublish3/xhtml/" ' .
        'xmlns:custom="http://ez.no/namespaces/ezpublish3/custom/">%s</section>' . "\n";

    const TEXT = '<paragraph>Lead%s text</paragraph><section><header%s>Heading</header><paragraph><ul><li%s><paragraph>First <strong%s>bold</strong></paragraph></li></ul></paragraph></section>';

    /** @var array content.ini values before the test */
    private $saved = array();

    private static function settings()
    {
        return array(
            'paragraph' => array( 'AvailableClasses' => array( 'intro' ), 'CustomAttributes' => array( 'note' ) ),
            'header' => array( 'AvailableClasses' => array( 'title' ), 'CustomAttributes' => array( 'level' ) ),
            'li' => array( 'AvailableClasses' => array( 'done' ), 'CustomAttributes' => array( 'state' ) ),
            'strong' => array( 'AvailableClasses' => array( 'highlight' ), 'CustomAttributes' => array( 'tone' ) ),
            'tr' => array( 'AvailableClasses' => array( 'highlight' ), 'CustomAttributes' => array( 'role' ) ),
            'td' => array( 'AvailableClasses' => array( 'num' ), 'CustomAttributes' => array( 'valign' ) ),
            'th' => array( 'AvailableClasses' => array( 'num' ), 'CustomAttributes' => array( 'valign' ) ),
        );
    }

    protected function setUp(): void
    {
        $ini = eZINI::instance( 'content.ini' );
        foreach ( self::settings() as $block => $values )
        {
            foreach ( $values as $name => $value )
            {
                $this->saved[] = array( $block, $name, $ini->hasVariable( $block, $name ) ? $ini->variable( $block, $name ) : null );
                $ini->setVariable( $block, $name, $value );
            }
        }
        // the schema reads the classes and custom attributes once
        unset( $GLOBALS['eZXMLSchemaGlobalInstance'] );
    }

    protected function tearDown(): void
    {
        $ini = eZINI::instance( 'content.ini' );
        foreach ( $this->saved as $entry )
        {
            if ( $entry[2] === null )
                $ini->removeSetting( $entry[0], $entry[1] );
            else
                $ini->setVariable( $entry[0], $entry[1], $entry[2] );
        }
        $this->saved = array();
        unset( $GLOBALS['eZXMLSchemaGlobalInstance'] );
    }

    private static function table( array $cells )
    {
        // $cells: rows of [ tag, attributes, text ]
        $xml = '<paragraph><table border="1" width="100%"><tr><th><paragraph>A</paragraph></th><th><paragraph>B</paragraph></th></tr>';
        foreach ( $cells as $row )
        {
            $xml .= '<tr' . $row[0] . '>';
            foreach ( $row[1] as $cell )
                $xml .= '<' . $cell[0] . $cell[1] . '><paragraph>' . $cell[2] . '</paragraph></' . $cell[0] . '>';
            $xml .= '</tr>';
        }
        return $xml . '</table></paragraph>';
    }

    public static function edits()
    {
        $plain = array( array( '', array( array( 'td', '', 'a1' ), array( 'td', '', 'b1' ) ) ), array( '', array( array( 'td', '', 'a2' ), array( 'td', '', 'b2' ) ) ) );
        $col = ' xhtml:width="30%" align="right" class="num" custom:valign="top"';
        $headerCol = $col;
        return array(
            'paragraph class and custom attribute' => array( 'tag-paragraph', vsprintf( self::TEXT, array( '', '', '', '' ) ),
                vsprintf( str_replace( '<paragraph>Lead', '<paragraph class="intro" custom:note="Lead &amp; &quot;more&quot;">Lead', self::TEXT ), array( '', '', '', '' ) ) ),
            'header class and custom attribute' => array( 'tag-header', vsprintf( self::TEXT, array( '', '', '', '' ) ),
                vsprintf( self::TEXT, array( '', ' class="title" custom:level="major"', '', '' ) ) ),
            'list item class and custom attribute' => array( 'tag-list-item', vsprintf( self::TEXT, array( '', '', '', '' ) ),
                vsprintf( self::TEXT, array( '', '', ' class="done" custom:state="ok"', '' ) ) ),
            'strong class and custom attribute' => array( 'tag-strong', vsprintf( self::TEXT, array( '', '', '', '' ) ),
                vsprintf( self::TEXT, array( '', '', '', ' class="highlight" custom:tone="loud"' ) ) ),
            'row class and custom attribute' => array( 'row', self::table( $plain ),
                self::table( array( array( ' class="highlight" custom:role="data"', $plain[0][1] ), $plain[1] ) ) ),
            'cell properties applied to a column' => array( 'cell-column', self::table( $plain ),
                str_replace( '<th><paragraph>B', '<th' . $headerCol . '><paragraph>B',
                    self::table( array( array( '', array( array( 'td', '', 'a1' ), array( 'td', $col, 'b1' ) ) ),
                                        array( '', array( array( 'td', '', 'a2' ), array( 'td', $col, 'b2' ) ) ) ) ) ) ),
            'cell properties applied to a row, as header cells' => array( 'cell-row-header', self::table( $plain ),
                self::table( array( array( '', array( array( 'th', ' custom:valign="middle"', 'a1' ), array( 'th', ' custom:valign="middle"', 'b1' ) ) ), $plain[1] ) ) ),
            'cell properties applied to the whole table' => array( 'cell-table', self::table( $plain ),
                str_replace( array( '<th>', '<td>' ), array( '<th align="center">', '<td align="center">' ), self::table( $plain ) ) ),
            'non-breaking space' => array( 'nbsp', '<paragraph>It is 10 km far.</paragraph>', "<paragraph>It is 10\u{a0}km \u{a0}far.</paragraph>" ),
            'stored non-breaking spaces stay' => array( 'none', "<paragraph>A\u{a0}B, <strong>x\u{a0}\u{a0}y</strong>\u{a0}</paragraph><section><header>10\u{a0}km</header></section>",
                "<paragraph>A\u{a0}B, <strong>x\u{a0}\u{a0}y</strong>\u{a0}</paragraph><section><header>10\u{a0}km</header></section>" ),
        );
    }

    private static function node()
    {
        $extension = dirname( __DIR__, 2 );
        if ( !is_dir( $extension . '/node_modules/happy-dom' ) || !is_dir( $extension . '/node_modules/@happy-dom/global-registrator' ) )
            return null;
        $out = array();
        exec( 'node --version 2>/dev/null', $out, $status );
        return $status === 0 ? $extension : null;
    }

    private static function runNode( $extension, array $command, $html )
    {
        $process = proc_open( $command, array( 0 => array( 'pipe', 'r' ), 1 => array( 'pipe', 'w' ), 2 => array( 'pipe', 'w' ) ), $pipes, $extension );
        if ( !is_resource( $process ) )
            throw new RuntimeException( 'node did not start' );
        fwrite( $pipes[0], $html );
        fclose( $pipes[0] );
        $out = stream_get_contents( $pipes[1] );
        $error = stream_get_contents( $pipes[2] );
        fclose( $pipes[1] );
        fclose( $pipes[2] );
        if ( proc_close( $process ) !== 0 )
            throw new RuntimeException( implode( ' ', $command ) . ' failed: ' . $error );
        return $out;
    }

    #[DataProvider( 'edits' )]
    public function testTheEditIsStoredAndStaysThroughTwoMorePasses( $edit, $before, $after )
    {
        $extension = self::node();
        if ( $extension === null )
            $this->markTestSkipped( 'node or the node_modules of exp_oe_tiptap are missing (npm ci)' );

        $expected = sprintf( self::SECTION, $after );
        $xml = sprintf( self::SECTION, $before );
        for ( $pass = 1; $pass <= 3; $pass++ )
        {
            $html = expOETiptapRoundtrip::xmlToEditorHTML( $xml );
            $command = $pass === 1 ? array( 'node', 'tests/js/schema/through-editor.mjs', $edit ) : array( 'node', 'tests/js/schema/through-tiptap.mjs' );
            $posted = self::runNode( $extension, $command, $html );
            $xml = expOETiptapRoundtrip::editorHTMLToXML( $posted, $messages );
            $this->assertSame( array(), (array) $messages, "pass $pass: parser messages" );
            $compare = expOETiptapRoundtrip::compare( $expected, $xml );
            $this->assertSame( 'identical', $compare['result'], "pass $pass ($edit): " . $compare['detail'] . "\nposted: $posted" );
        }
    }
}
