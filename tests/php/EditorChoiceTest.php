<?php
/**
 * The editor choice since 0.1.1: Tiptap is the engine "tiptap" of ezoe's registry, so there is one choice (ezoe's
 * EditorEngine, EngineSwitch and preference ezoe_engine). Tested here: the registration, the translation between
 * ezoe's engines and this extension's two editors, the migration of the 0.1.0 preference exp_oe_editor, the target
 * of the Tiptap editor's switch button, and the extension's own settings.
 */

require_once __DIR__ . '/bootstrap.php';

use PHPUnit\Framework\TestCase;

final class EditorChoiceTest extends TestCase
{
    protected function setUp(): void
    {
        if ( !class_exists( 'expOEEditor' ) )
            $this->markTestSkipped( 'ezoe has no engine registry in this root' );
        expOEEditor::reset();
    }

    protected function tearDown(): void
    {
        eZINI::resetInstance( 'exp_oe_tiptap.ini' );
        eZINI::resetInstance( 'ezoe.ini' );
        expOETiptapEditor::reset();
        if ( class_exists( 'expOEEditor' ) )
            expOEEditor::reset();
    }

    private function setting( $block, $name, $value )
    {
        eZINI::instance( 'exp_oe_tiptap.ini' )->setVariable( $block, $name, $value );
    }

    private function ezoe( $name, $value )
    {
        eZINI::instance( 'ezoe.ini' )->setVariable( 'EditorSettings', $name, $value );
        expOEEditor::reset();
    }

    public function testTiptapIsRegisteredInEzoesRegistry()
    {
        $registered = expOEEditor::registered();
        $this->assertSame( 'expOETiptapEngine', $registered['tiptap'] );
        $this->assertArrayHasKey( 'tinymce3', $registered, 'the extension adds to the list, it never replaces it' );
        $this->assertArrayHasKey( 'tinymce8', $registered );
    }

    public function testTheEngineIsAvailableWhileTheBundleIsBuilt()
    {
        $engines = expOEEditor::engines();
        $this->assertArrayHasKey( 'tiptap', $engines );
        $this->assertInstanceOf( 'expOETiptapEngine', $engines['tiptap'] );
        $this->assertSame( 'Tiptap', expOEEditor::labels()['tiptap'] );
        $this->assertSame( array(), expOEEditor::problems() );
    }

    public function testWithoutTheBundleTheEngineIsUnavailableAndNeverChosen()
    {
        $this->setting( 'EditorSettings', 'Scripts', array( 'exp_oe_tiptap/no-such-bundle.js' ) );
        expOEEditor::reset();
        $this->assertArrayNotHasKey( 'tiptap', expOEEditor::engines() );
        $this->assertSame( 'tinymce3', expOEEditor::resolve( 'tiptap' ) );
        foreach ( expOEEditor::details() as $row )
        {
            if ( $row['identifier'] === 'tiptap' )
                $this->assertSame( 'unavailable', $row['status'] );
        }
    }

    public function testTheEngineShowsNameVersionDescriptionAndStatus()
    {
        $rows = array();
        foreach ( expOEEditor::details() as $row )
            $rows[$row['identifier']] = $row;
        $this->assertArrayHasKey( 'tiptap', $rows );
        $this->assertSame( 'Tiptap', $rows['tiptap']['label'] );
        $this->assertSame( exp_oe_tiptapInfo::info()['Version'], $rows['tiptap']['version'] );
        $this->assertMatchesRegularExpression( '/^0\.1\.\d+$/', $rows['tiptap']['version'] );
        $this->assertStringContainsString( 'Tiptap', $rows['tiptap']['description'] );
        $this->assertSame( 'available', $rows['tiptap']['status'] );
        $this->assertSame( 'expOETiptapEngine', $rows['tiptap']['class'] );
    }

    public function testTheEngineRendersTheTiptapTemplate()
    {
        $engine = new expOETiptapEngine();
        $this->assertSame( 'tiptap', $engine->identifier() );
        $this->assertSame( 'design:content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl', $engine->template() );
        $this->assertTrue( is_file( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' ) );
        $this->assertSame( array( 'scripts' => array(), 'styles' => array() ), $engine->assets(), 'the template puts the bundle on the page' );
    }

    public function testTheSwitchIsEzoesEngineSwitch()
    {
        $this->assertSame( 'enabled', eZINI::instance( 'ezoe.ini' )->variable( 'EditorSettings', 'EngineSwitch' ), 'shipped on, as the 0.1.0 switch was' );
        $this->assertTrue( expOETiptapEditor::switchEnabled() );
        $this->ezoe( 'EngineSwitch', 'disabled' );
        $this->assertFalse( expOETiptapEditor::switchEnabled() );
        $this->assertFalse( expOETiptapEditor::switchAllowed() );
    }

    public function testEzoeStaysTheDefault()
    {
        $this->assertSame( 'tinymce3', expOEEditor::configuredEngine() );
        $this->assertSame( 'ezoe', expOETiptapEditor::defaultEditor() );
        $this->ezoe( 'EditorEngine', 'tiptap' );
        $this->assertSame( 'tiptap', expOEEditor::configuredEngine() );
        $this->assertSame( 'tiptap', expOETiptapEditor::defaultEditor() );
    }

    public function testEditorOfEngine()
    {
        $this->assertSame( 'tiptap', expOETiptapEditor::editorOfEngine( 'tiptap' ) );
        $this->assertSame( 'ezoe', expOETiptapEditor::editorOfEngine( 'tinymce3' ) );
        $this->assertSame( 'ezoe', expOETiptapEditor::editorOfEngine( 'tinymce8' ) );
        $this->assertSame( 'ezoe', expOETiptapEditor::editorOfEngine( null ) );
    }

    public function testEngineOfEditor()
    {
        $this->assertSame( 'tiptap', expOETiptapEditor::engineOfEditor( 'tiptap', 'tinymce3' ) );
        $this->assertSame( '', expOETiptapEditor::engineOfEditor( 'ezoe', 'tinymce8' ), 'ezoe = the site TinyMCE' );
        $this->assertSame( 'tinymce3', expOETiptapEditor::engineOfEditor( 'ezoe', 'tiptap' ), 'ezoe on a Tiptap site = TinyMCE 3' );
        $this->assertSame( '', expOETiptapEditor::engineOfEditor( '', 'tiptap' ) );
        $this->assertNull( expOETiptapEditor::engineOfEditor( 'ckeditor', 'tinymce3' ) );
        $this->assertNull( expOETiptapEditor::engineOfEditor( 'TIPTAP', 'tinymce3' ) );
    }

    public function testTheOldTiptapPreferenceKeepsTiptap()
    {
        $this->assertSame( 'tiptap', expOETiptapEditor::migratedEngine( 'tiptap', false, 'tinymce3' ) );
        $this->assertSame( 'tiptap', expOETiptapEditor::migratedEngine( 'tiptap', '', 'tinymce3' ) );
        // in 0.1.0 exp_oe_editor=tiptap won over ezoe's own preference
        $this->assertSame( 'tiptap', expOETiptapEditor::migratedEngine( 'tiptap', 'tinymce8', 'tinymce3' ) );
        $this->assertNull( expOETiptapEditor::migratedEngine( 'tiptap', 'tiptap', 'tinymce3' ), 'nothing to write' );
    }

    public function testTheOldEzoePreferenceKeepsEzoesChoice()
    {
        $this->assertNull( expOETiptapEditor::migratedEngine( 'ezoe', false, 'tinymce3' ), 'the site default' );
        $this->assertNull( expOETiptapEditor::migratedEngine( 'ezoe', 'tinymce8', 'tinymce3' ) );
        $this->assertSame( 'tinymce3', expOETiptapEditor::migratedEngine( 'ezoe', false, 'tiptap' ), 'TinyMCE stays TinyMCE on a Tiptap site' );
    }

    public function testNoOrUnknownOldPreferenceMigratesNothing()
    {
        $this->assertNull( expOETiptapEditor::migratedEngine( false, false, 'tinymce3' ) );
        $this->assertNull( expOETiptapEditor::migratedEngine( '', 'tinymce8', 'tinymce3' ) );
        $this->assertNull( expOETiptapEditor::migratedEngine( 'ckeditor', false, 'tinymce3' ) );
    }

    public function testTheSwitchButtonOfTiptapGoesToTheSiteTinyMCE()
    {
        $this->assertSame( 'tinymce8', expOETiptapEditor::switchTargetOf( array( 'tinymce3', 'tinymce8' ), 'tinymce8' ) );
        $this->assertSame( 'tinymce3', expOETiptapEditor::switchTargetOf( array( 'tinymce3', 'tinymce8' ), 'tinymce3' ) );
        $this->assertSame( 'tinymce3', expOETiptapEditor::switchTargetOf( array( 'tinymce3', 'tinymce8' ), 'tiptap' ) );
        $this->assertSame( 'tinymce8', expOETiptapEditor::switchTargetOf( array( 'tinymce8' ), 'tiptap' ) );
        $this->assertSame( 'tinymce3', expOETiptapEditor::switchTargetOf( array( 'tinymce3' ), 'gone' ) );
        $this->assertNull( expOETiptapEditor::switchTargetOf( array(), 'tinymce3' ) );
    }

    public function testTheSwitchTargetComesFromTheRegistry()
    {
        $this->assertSame( 'tinymce3', expOETiptapEditor::switchTarget() );
        $this->ezoe( 'EditorEngine', 'tinymce8' );
        $this->assertSame( 'tinymce8', expOETiptapEditor::switchTarget() );
    }

    public function testShippedSettings()
    {
        $this->assertSame( array( 'exp_oe_tiptap/exp_oe_tiptap.js' ), expOETiptapEditor::scripts() );
        $this->assertSame( array( 'exp_oe_tiptap/exp_oe_tiptap.css' ), expOETiptapEditor::styles() );
        $this->assertSame( 'false', expOETiptapEditor::setting( 'AISettings', 'Enabled' ) );
        $this->assertSame( '', expOETiptapEditor::setting( 'AISettings', 'ApiKey' ), 'no API key in a committed file' );
        $this->assertContains( 'improve', expOETiptapEditor::aiCommands() );
        $this->assertNull( expOETiptapEditor::setting( 'EditorSettings', 'DefaultEditor' ), 'the 0.1.0 default is ezoe.ini EditorEngine now' );
        $this->assertNull( expOETiptapEditor::setting( 'EditorSettings', 'AllowSwitch' ), 'the 0.1.0 switch is ezoe.ini EngineSwitch now' );
    }

    public function testTheShippedEzoeIniOnlyAddsToTheList()
    {
        $source = (string) file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/settings/ezoe.ini.append.php' );
        $this->assertStringContainsString( 'Engines[tiptap]=expOETiptapEngine', $source );
        $this->assertDoesNotMatchRegularExpression( '/^Engines\[\]\s*$/m', $source, 'an empty Engines[] would drop ezoe\'s own engines' );
        $this->assertDoesNotMatchRegularExpression( '/^EditorEngine=/m', $source, 'ezoe stays the default' );
    }

    public function testAiIsOffWhileTheSettingIsOff()
    {
        $this->assertFalse( expOETiptapEditor::aiAllowed() );
    }

    public function testBundleAvailabilityFollowsTheFile()
    {
        $this->setting( 'EditorSettings', 'Scripts', array( 'exp_oe_tiptap/no-such-bundle.js' ) );
        $this->assertFalse( expOETiptapEditor::bundleFile() );
        $this->assertFalse( expOETiptapEditor::tiptapAvailable() );

        $this->setting( 'EditorSettings', 'Scripts', array() );
        $this->assertFalse( expOETiptapEditor::tiptapAvailable() );
    }

    public function testCacheKeyIsShortAndStable()
    {
        $key = expOETiptapEditor::cacheKey();
        $this->assertMatchesRegularExpression( '/^[0-9a-f]{10}$/', $key );
        $this->assertSame( $key, expOETiptapEditor::cacheKey() );
    }

    public function testOtherAndLabels()
    {
        $this->assertSame( 'tiptap', expOETiptapEditor::other( 'ezoe' ) );
        $this->assertSame( 'ezoe', expOETiptapEditor::other( 'tiptap' ) );
        $this->assertSame( 'Tiptap', expOETiptapEditor::label( 'tiptap' ) );
        $this->assertTrue( expOETiptapEditor::isEditor( 'ezoe' ) );
        $this->assertFalse( expOETiptapEditor::isEditor( 'TIPTAP' ) );
        $this->assertFalse( expOETiptapEditor::isEditor( null ) );
    }
}
