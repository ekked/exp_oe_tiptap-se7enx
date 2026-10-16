<?php
/**
 * The edited field of an AI request: the ids the server function reads from the request, the access check before
 * the provider is called, and the context a provider with setRequestContext() receives.
 *
 * @license GNU General Public License v2.0 (or any later version)
 */

require_once __DIR__ . '/../bootstrap.php';

use PHPUnit\Framework\TestCase;

final class AIRequestContextTest extends TestCase
{
    protected function setUp(): void
    {
        if ( !class_exists( 'ezjscServerFunctions' ) )
            $this->markTestSkipped( 'ezjscore is not installed in this root' );
    }

    public function testRequestIdsAreNumbersOrZero()
    {
        $this->assertSame( array( 'object_id' => 57, 'version' => 3, 'attribute_id' => 812, 'language' => 'ger-DE' ),
            expOETiptapServerFunctions::requestIds( array( 'contentObjectId' => '57', 'version' => '3', 'attributeId' => '812', 'languageCode' => 'ger-DE' ) ) );
        $this->assertSame( array( 'object_id' => 0, 'version' => 0, 'attribute_id' => 0, 'language' => '' ),
            expOETiptapServerFunctions::requestIds( array() ) );
        $bad = expOETiptapServerFunctions::requestIds( array( 'contentObjectId' => '5 OR 1=1', 'version' => '-3', 'attributeId' => array( '8' ),
                                                              'languageCode' => 'ger-DE"><script>' ) );
        $this->assertSame( array( 'object_id' => 0, 'version' => 0, 'attribute_id' => 0, 'language' => '' ), $bad );
        $this->assertSame( 0, expOETiptapServerFunctions::requestIds( array( 'contentObjectId' => '0' ) )['object_id'] );
        $this->assertSame( 0, expOETiptapServerFunctions::requestIds( array( 'contentObjectId' => '12345678901' ) )['object_id'] );
    }

    public function testTheServerFunctionChecksTheFieldAfterTheRequestAndBeforeTheProvider()
    {
        $source = (string) file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/expoetiptapserverfunctions.php' );
        $check = strpos( $source, '$service->checkRequest(' );
        $context = strpos( $source, '$service->setRequestContext( self::contentContext( self::requestIds( $_POST ) ) );' );
        $run = strpos( $source, 'return $service->run(' );
        $this->assertNotFalse( $context );
        $this->assertLessThan( $context, $check );
        $this->assertLessThan( $run, $context );
        $this->assertStringContainsString( '->canEdit(', $source );
        $this->assertStringContainsString( "attribute( 'contentobject_id' ) !== \$ids['object_id']", $source );
    }

    public function testAProviderWithSetRequestContextGetsTheFieldAndTheCommand()
    {
        $provider = new AIRequestContextTestProvider();
        $service = new expOETiptapAIService( array( 'Enabled' => 'true' ), $provider );
        $service->setRequestContext( array( 'object_id' => 57, 'attribute_id' => 812, 'version' => 3, 'language' => 'ger-DE' ) );
        $service->run( 'shorten', 'Some text' );
        $this->assertSame( array( 'command' => 'shorten', 'object_id' => 57, 'attribute_id' => 812, 'version' => 3, 'language' => 'ger-DE' ), $provider->context );
    }
}

class AIRequestContextTestProvider implements expOETiptapAIProvider
{
    public $context = null;

    public function setRequestContext( array $context )
    {
        $this->context = $context;
    }

    public function complete( $system, $user, array $options )
    {
        return 'Short.';
    }

    public function modelName()
    {
        return 'context-model';
    }
}
