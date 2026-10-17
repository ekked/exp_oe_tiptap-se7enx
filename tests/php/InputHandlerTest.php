<?php
/**
 * expOETiptapXMLInput is ezoe's eZOEXMLInput with another edit template: it extends it, overrides nothing that
 * parses or validates, and is registered as the alias of eZSimplifiedXMLInput.
 */

require_once __DIR__ . '/bootstrap.php';

use PHPUnit\Framework\TestCase;

final class InputHandlerTest extends TestCase
{
    protected function setUp(): void
    {
        if ( !class_exists( 'eZOEXMLInput' ) )
            $this->markTestSkipped( 'ezoe is not installed in this root' );
    }

    public function testExtendsEzoesInputHandler()
    {
        $this->assertTrue( is_subclass_of( 'expOETiptapXMLInput', 'eZOEXMLInput' ) );
        $this->assertTrue( is_subclass_of( 'expOETiptapXMLInput', 'eZXMLInputHandler' ) );
    }

    public function testParsingAndValidationStayEzoes()
    {
        $own = array();
        foreach ( ( new ReflectionClass( 'expOETiptapXMLInput' ) )->getMethods() as $method )
        {
            if ( $method->getDeclaringClass()->getName() === 'expOETiptapXMLInput' )
                $own[] = $method->getName();
        }
        sort( $own );
        $this->assertSame( array( 'attribute', 'attributes', 'customObjectAttributeHTTPAction', 'editorInfo', 'switchActionEditor' ), $own );
        foreach ( array( 'validateInput', 'inputXML', 'isValid', 'convertInput' ) as $inherited )
            $this->assertNotContains( $inherited, $own );
    }

    public function testEditTemplateIsEzoes()
    {
        // since 0.1.1 ezoe's ezxmltext_ezoe.tpl renders every engine, Tiptap included
        $handler = ( new ReflectionClass( 'expOETiptapXMLInput' ) )->newInstanceWithoutConstructor();
        $attribute = null;
        $this->assertSame( 'ezoe', $handler->editTemplateSuffix( $attribute ) );
        $this->assertTrue( is_file( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap.tpl' ) );
        $this->assertTrue( is_file( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' ) );
    }

    public function testTemplateAttributesKeepEzoesAndAddTheEditor()
    {
        $handler = ( new ReflectionClass( 'expOETiptapXMLInput' ) )->newInstanceWithoutConstructor();
        $attributes = $handler->attributes();
        $this->assertContains( 'exp_oe_editor', $attributes );
        foreach ( array( 'input_xml', 'is_editor_enabled', 'can_disable', 'editor_layout_settings', 'custom_tag_definitions', 'engine' ) as $ezoe )
            $this->assertContains( $ezoe, $attributes );
        $this->assertTrue( $handler->hasAttribute( 'exp_oe_editor' ) );
    }

    public function testEveryEngineAttributeMovesThePreferenceOf010First()
    {
        // ezoe's engine switch reads engine_switch_options since Exponential 6.0.15 (engine_switch_choices before):
        // each of them moves the preference exp_oe_editor of 0.1.0 to ezoe_engine before ezoe resolves the engine
        $source = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/expoetiptapxmlinput.php' );
        $this->assertStringContainsString( "if ( \$name === 'engine' || \$name === 'engine_switch_choices' || \$name === 'engine_switch_options' )\n            expOETiptapEditor::migratePreference();", $source );
    }

    public function testRegisteredAsTheAliasOfTheSimplifiedInput()
    {
        $aliases = eZINI::instance( 'ezxml.ini' )->variable( 'InputSettings', 'AliasClasses' );
        $this->assertSame( 'expOETiptapXMLInput', $aliases['eZSimplifiedXMLInput'] );
    }

    public function testTheOldTemplateNamePassesOnToEzoe()
    {
        $tpl = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap.tpl' );
        $this->assertStringContainsString( "design:content/datatype/edit/ezxmltext_ezoe.tpl", $tpl );
        $this->assertStringNotContainsString( "{include uri='design:content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl'", $tpl, 'ezoe picks the engine' );
    }

    public function testTheTiptapEditorHasEzoesSwitchButtonsAndItsLabel()
    {
        $tpl = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' );
        $this->assertStringContainsString( '$input_handler.engine.config', $tpl, 'the settings are the engine config' );
        $this->assertStringContainsString( "design:content/datatype/edit/ezxmltext_ezoe_engine_switch.tpl", $tpl );
        $this->assertStringContainsString( "'Editing with %editor'|i18n( 'extension/exp_oe_tiptap'", $tpl );
        $this->assertFalse( is_file( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_switch.tpl' ),
                            'one set of switch buttons: ezoe\'s' );
    }

    public function testTheOldSwitchButtonMapsOntoEzoesChoice()
    {
        $this->assertSame( 'switch_engine_tinymce3', 'switch_engine_' . expOETiptapEditor::switchTarget() );
        $source = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/expoetiptapeditor.php' );
        $this->assertStringContainsString( 'expOEEditor::setUserEngine( $engine )', $source );
    }

    public function testTheTiptapTemplatePostsTheSameField()
    {
        $tpl = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' );
        $this->assertStringContainsString( "concat( \$attribute_base, '_data_text_', \$attribute.id )", $tpl );
        $this->assertStringContainsString( '{$input_handler.input_xml}', $tpl );
        // the options are JSON after the textarea, the start file calls the bundle (no inline script)
        $this->assertStringContainsString( '<script type="application/json" data-exp-oe-options-for="{$editor_id|wash}">', $tpl );
        $this->assertStringContainsString( "<script src=\"{'javascript/exp_oe_tiptap/exp_oe_tiptap_start.js'|ezdesign( 'no' )}\" charset=\"utf-8\" defer></script>", $tpl );
        $this->assertDoesNotMatchRegularExpression( '/<script(?![^>]*(\\bsrc=|type="application\/json"))[^>]*>/', preg_replace( '/\{\*.*?\*\}/s', '', $tpl ), 'no inline script' );
        $this->assertStringContainsString( 'window.ExpOETiptap.init( textarea, options )',
                                           file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/javascript/exp_oe_tiptap/exp_oe_tiptap_start.js' ) );
    }
}
