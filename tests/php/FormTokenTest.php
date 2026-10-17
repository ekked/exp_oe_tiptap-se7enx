<?php
/**
 * The form token of the AI calls and the switch: always required. With ezformtoken active its token is used (its
 * output filter renders it); without ezformtoken the extension's own session token is rendered into the editor
 * options and compared with hash_equals.
 */

require_once __DIR__ . '/bootstrap.php';

use PHPUnit\Framework\TestCase;

final class FormTokenTest extends TestCase
{
    public function testSessionTokenIsCreatedOncePerSession()
    {
        $session = array();
        $token = expOETiptapEditor::sessionToken( true, $session );
        $this->assertMatchesRegularExpression( '/^[0-9a-f]{64}$/', $token );
        $this->assertSame( $token, $session[expOETiptapEditor::SESSION_TOKEN] );
        $this->assertSame( $token, expOETiptapEditor::sessionToken( true, $session ), 'the same for the whole session' );
        $this->assertSame( $token, expOETiptapEditor::sessionToken( false, $session ) );

        $other = array();
        $this->assertNotSame( $token, expOETiptapEditor::sessionToken( true, $other ), 'another session, another token' );
    }

    public function testACheckNeverCreatesTheToken()
    {
        $session = array();
        $this->assertNull( expOETiptapEditor::sessionToken( false, $session ) );
        $this->assertSame( array(), $session );
        // a broken value in the session is no token
        $session = array( expOETiptapEditor::SESSION_TOKEN => 'short' );
        $this->assertNull( expOETiptapEditor::sessionToken( false, $session ) );
        $session = array( expOETiptapEditor::SESSION_TOKEN => array( 'x' ) );
        $this->assertNull( expOETiptapEditor::sessionToken( false, $session ) );
    }

    public function testEzformtokenCountsOnlyWhenActive()
    {
        $this->assertFalse( expOETiptapEditor::formTokenActive( array() ), 'its class alone is not enough' );
        $this->assertFalse( expOETiptapEditor::formTokenActive( array( 'ezoe', 'ezjscore' ) ) );
        $this->assertSame( class_exists( 'ezxFormToken' ) && ezxFormToken::isEnabled(), expOETiptapEditor::formTokenActive( array( 'ezformtoken' ) ) );
    }

    public function testTheSessionTokenPassesTheChecksAndOthersDoNot()
    {
        $session = array();
        $token = expOETiptapEditor::sessionToken( true, $session );
        $expected = expOETiptapEditor::sessionToken( false, $session );
        $service = new expOETiptapAIService( array( 'Enabled' => 'true' ) );
        $service->checkRequest( 'POST', $token, $expected, true );
        $this->assertTrue( expOETiptapEditor::tokenValid( array( 'ezxform_token' => $token ), array(), $expected ) );
        foreach ( array( null, '', strrev( $token ), substr( $token, 0, 63 ), '@$ezxFormToken@' ) as $given )
        {
            try
            {
                $service->checkRequest( 'POST', $given, $expected, true );
                $this->fail( 'a wrong token passed: ' . var_export( $given, true ) );
            }
            catch ( expOETiptapAIException $e )
            {
                $this->assertStringContainsString( 'form token', $e->getMessage() );
            }
            $this->assertFalse( expOETiptapEditor::tokenValid( array( 'ezxform_token' => $given ), array(), $expected ) );
        }
    }

    public function testTheServerFunctionAndTheTemplateUseTheExtensionsToken()
    {
        $functions = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/expoetiptapserverfunctions.php' );
        $this->assertStringContainsString( 'expOETiptapEditor::expectedToken()', $functions );
        $this->assertStringNotContainsString( 'ezxFormToken::isEnabled()', $functions, 'no path without a token' );
        $editor = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/expoetiptapeditor.php' );
        $this->assertMatchesRegularExpression( '/hash_equals\(/', $editor );
        $template = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' );
        $this->assertStringContainsString( '"formToken": {json_encode( $exp_oe.form_token )}', $template );
        $this->assertStringNotContainsString( '"formToken": "@$ezxFormToken@"', $template );
    }
}
