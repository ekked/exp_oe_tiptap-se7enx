<?php
/**
 * Inline custom tags through the editor and ezoe's parser: the formulas math_latex and math_mathml are atomic inline
 * custom tags (exp_oe_tiptap.ini [EditorSettings] AtomicInlineCustomTags[]), one piece in the editor, and the other
 * inline custom tags (here strike) stay formatting on the text.
 *
 * Each case: stored ezxml -> eZOEXMLInput::inputXML() -> the editor with one edit made by its dialogs or commands
 * (tests/js/schema/through-editor.mjs, node) -> eZOEInputParser -> ezxml, which must be the expected ezxml
 * identically; then two more passes without an edit (through-tiptap.mjs) change nothing. Until the formulas were
 * atoms, a second edit in the custom tag dialog nested a copy of the tag, bold around a formula went inside it and
 * into its TeX source, two adjacent formulas with the same attributes merged, and typing after a formula went into it.
 *
 * Needs node and the extension's node_modules (npm ci); skipped without them. No database: no links or embeds.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/roundtrip/expoetiptaproundtrip.php';

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class InlineCustomTagRoundtripTest extends TestCase
{
    const SECTION = '<?xml version="1.0" encoding="utf-8"?>' . "\n" .
        '<section xmlns:image="http://ez.no/namespaces/ezpublish3/image/" xmlns:xhtml="http://ez.no/namespaces/ezpublish3/xhtml/" ' .
        'xmlns:custom="http://ez.no/namespaces/ezpublish3/custom/">%s</section>' . "\n";

    /** @var array content.ini values before the test */
    private $saved = array();

    protected function setUp(): void
    {
        $ini = eZINI::instance( 'content.ini' );
        $tags = (array) $ini->variable( 'CustomTagSettings', 'AvailableCustomTags' );
        $inline = $ini->hasVariable( 'CustomTagSettings', 'IsInline' ) ? (array) $ini->variable( 'CustomTagSettings', 'IsInline' ) : array();
        $values = array(
            array( 'CustomTagSettings', 'AvailableCustomTags', array_values( array_unique( array_merge( $tags, array( 'math_latex', 'math_mathml', 'strike' ) ) ) ) ),
            array( 'CustomTagSettings', 'IsInline', array_merge( $inline, array( 'math_latex' => 'true', 'math_mathml' => 'true', 'strike' => 'true' ) ) ),
            array( 'math_latex', 'CustomAttributes', array( 'display', 'alt' ) ),
            array( 'math_mathml', 'CustomAttributes', array( 'display', 'mathml' ) ),
            array( 'strike', 'CustomAttributes', array( 'tone' ) ),
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

    private static function latex( $text, $alt = 'alt' )
    {
        return '<custom name="math_latex" custom:display="inline" custom:alt="' . $alt . '">' . $text . '</custom>';
    }

    public static function edits()
    {
        $mathml = '<custom name="math_mathml" custom:display="inline" custom:mathml="&lt;math&gt;&lt;mi&gt;a&lt;/mi&gt;&lt;/math&gt;">a</custom>';
        return array(
            // A1
            'formula edited in the custom tag dialog' => array( 'custom-edit-formula',
                '<paragraph>Text ' . self::latex( 'MATH' ) . ' end</paragraph>',
                '<paragraph>Text ' . self::latex( 'x^3', 'neu' ) . ' end</paragraph>' ),
            // a line break typed into the content would be removed by the parser ("\cdot<line break>x" gave
            // "\cdotx"): it becomes a space, a TeX comment goes with its line break, a control word keeps its end
            'line breaks and a TeX comment typed into the content' => array( 'custom-edit-formula-lines',
                '<paragraph>Text ' . self::latex( 'MATH' ) . ' end</paragraph>',
                '<paragraph>Text ' . self::latex( '\cdot x + \alpha beta' ) . ' end</paragraph>' ),
            'a formula made of a selection over two paragraphs' => array( 'formula-from-two-paragraphs',
                '<paragraph>a+b</paragraph><paragraph>c+d</paragraph>',
                '<paragraph>' . self::latex( 'a+b c+d', 'a' ) . '</paragraph>' ),
            'inline custom tag (a mark) edited in the custom tag dialog' => array( 'custom-edit-strike',
                '<paragraph>a <custom name="strike" custom:tone="soft">struck</custom> b</paragraph>',
                '<paragraph>a <custom name="strike" custom:tone="loud">struck</custom> b</paragraph>' ),
            // A2
            'bold over a sentence with a formula' => array( 'bold-paragraph',
                '<paragraph>Text ' . self::latex( 'MATH' ) . ' end</paragraph>',
                '<paragraph><strong>Text ' . self::latex( 'MATH' ) . ' end</strong></paragraph>' ),
            'bold around a formula, edited elsewhere' => array( 'type-after-formula',
                '<paragraph>Text ' . self::latex( 'y' ) . ' and <strong>bold ' . self::latex( '\frac{a}{b}', 'a over b' ) . '</strong> after.</paragraph>',
                '<paragraph>Text ' . self::latex( 'y' ) . ' plus and <strong>bold ' . self::latex( '\frac{a}{b}', 'a over b' ) . '</strong> after.</paragraph>' ),
            'remove formatting keeps the formula' => array( 'removeformat-paragraph',
                '<paragraph><strong>bold ' . self::latex( 'x^2' ) . '</strong> after</paragraph>',
                '<paragraph>bold ' . self::latex( 'x^2' ) . ' after</paragraph>' ),
            // A3
            'adjacent formulas with the same attributes stay two' => array( 'none',
                '<paragraph>' . self::latex( 'a', 'x' ) . self::latex( 'b', 'x' ) . ' and ' . $mathml . $mathml . '</paragraph>',
                '<paragraph>' . self::latex( 'a', 'x' ) . self::latex( 'b', 'x' ) . ' and ' . $mathml . $mathml . '</paragraph>' ),
            // typing and literal
            'typing after a formula does not go into it' => array( 'type-after-formula',
                '<paragraph>Text ' . self::latex( 'MATH' ) . ' end</paragraph>',
                '<paragraph>Text ' . self::latex( 'MATH' ) . ' plus end</paragraph>' ),
            'a paragraph converted to literal keeps the text of its formula' => array( 'literal',
                '<paragraph>Text ' . self::latex( 'MATH' ) . ' end</paragraph>',
                '<paragraph><literal>Text MATH end</literal></paragraph>' ),
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
