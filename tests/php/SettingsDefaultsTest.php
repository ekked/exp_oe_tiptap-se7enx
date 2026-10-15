<?php
/**
 * The extension's own settings leave the skin undefined. An extension's settings are read after a siteaccess's,
 * so a Skin value in settings/exp_oe_tiptap.ini.append.php would hide every siteaccess's choice of skin.
 */

require_once __DIR__ . '/bootstrap.php';

use PHPUnit\Framework\TestCase;

final class SettingsDefaultsTest extends TestCase
{
    public function testSkinIsLeftToTheSiteaccess()
    {
        $file = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/settings/exp_oe_tiptap.ini.append.php' );
        $this->assertNotFalse( $file );
        $this->assertDoesNotMatchRegularExpression( '/^\s*Skin\s*=/m', $file, 'Skin is not set by the extension' );
        $this->assertMatchesRegularExpression( '/^#Skin=$/m', $file, 'the setting is named, commented out' );
    }

    public function testTheTemplateReadsTheSkinOnlyWhenItIsSet()
    {
        $tpl = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' );
        $this->assertStringContainsString( "ezini_hasvariable( 'EditorSettings', 'Skin', 'exp_oe_tiptap.ini' )", $tpl );
    }

    /** SourceEditable is named, left to the siteaccess as Skin is, and editable unless it says disabled */
    public function testSourceEditableIsEnabledUnlessASiteaccessDisablesIt()
    {
        $file = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/settings/exp_oe_tiptap.ini.append.php' );
        $this->assertStringStartsWith( '<?php /* #?ini charset="utf-8"?', $file, 'the INI wrapper' );
        $this->assertMatchesRegularExpression( '/^#SourceEditable=enabled$/m', $file );
        $this->assertDoesNotMatchRegularExpression( '/^\s*SourceEditable\s*=/m', $file );
        $php = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/expoetiptapeditor.php' );
        $this->assertStringContainsString( "self::setting( 'EditorSettings', 'SourceEditable', 'enabled' ) !== 'disabled'", $php );
        $tpl = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' );
        $this->assertStringContainsString( "sourceEditable: {cond( \$exp_oe.source_editable, 'true', 'false' )}", $tpl );
    }
}
