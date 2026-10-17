<?php
/**
 * The edited field of an AI request (expOETiptapAIRequestContext): the ids read from the request and the check of the
 * edit form with the kernel replaced by fakes (no database): a draft of the current user, edit access in the language
 * (editAccess()), the attribute of the object, a language of the site, the object a data policy needs. Also the
 * context a provider with setRequestContext() receives and the log line of a refused request.
 *
 * @license GNU General Public License v2.0 (or any later version)
 */

require_once __DIR__ . '/../bootstrap.php';

use PHPUnit\Framework\TestCase;

final class AIRequestContextTest extends TestCase
{
    const USER = 14;

    /** @var array objects by id */
    private $objects = array();

    /** @var array attributes by "id/version" */
    private $attributes = array();

    protected function setUp(): void
    {
        // object 57 with a draft (version 3) of the current user, version 2 published, version 4 a draft of another user
        $this->objects = array( 57 => new AIRequestContextTestObject( 57, array(
            2 => array( 'creator_id' => self::USER, 'status' => eZContentObjectVersion::STATUS_PUBLISHED ),
            3 => array( 'creator_id' => self::USER, 'status' => eZContentObjectVersion::STATUS_DRAFT ),
            4 => array( 'creator_id' => 99, 'status' => eZContentObjectVersion::STATUS_DRAFT ),
            5 => array( 'creator_id' => self::USER, 'status' => eZContentObjectVersion::STATUS_INTERNAL_DRAFT ),
        ) ), 60 => new AIRequestContextTestObject( 60, array( 1 => array( 'creator_id' => self::USER, 'status' => eZContentObjectVersion::STATUS_DRAFT ) ) ) );
        // attribute id/version => object id and language of the field
        $this->attributes = array( '812/3' => array( 57, 'ger-DE' ), '812/5' => array( 57, 'ger-DE' ), '813/3' => array( 57, 'eng-GB' ),
                                   '900/3' => array( 60, 'ger-DE' ) );
    }

    private function context()
    {
        $objects = &$this->objects;
        $attributes = $this->attributes;
        return new expOETiptapAIRequestContext(
            static function ( $id ) use ( &$objects ) { return isset( $objects[$id] ) ? $objects[$id] : null; },
            static function ( $id, $version ) use ( $attributes )
            {
                if ( !isset( $attributes[$id . '/' . $version] ) )
                    return null;
                list( $object, $language ) = $attributes[$id . '/' . $version];
                return new AIRequestContextTestRow( array( 'contentobject_id' => $object, 'language_code' => $language ) );
            },
            static function () { return self::USER; },
            static function () { return array( 'eng-GB', 'ger-DE' ); }
        );
    }

    private function ids( $object, $version, $attribute = 0, $language = '' )
    {
        return array( 'object_id' => $object, 'version' => $version, 'attribute_id' => $attribute, 'language' => $language );
    }

    private function refused( array $ids, $pattern, $requireObject = false )
    {
        try
        {
            $this->context()->check( $ids, $requireObject );
            $this->fail( 'accepted: ' . json_encode( $ids ) );
        }
        catch ( expOETiptapAIException $e )
        {
            $this->assertMatchesRegularExpression( $pattern, $e->getMessage() );
            return $e;
        }
    }

    public function testRequestIds()
    {
        $this->assertSame( $this->ids( 57, 3, 812, 'ger-DE' ),
            expOETiptapServerFunctions::requestIds( array( 'contentObjectId' => '57', 'version' => '3', 'attributeId' => '812', 'languageCode' => 'ger-DE' ) ) );
        $this->assertSame( $this->ids( 0, 0, 0, '' ), expOETiptapAIRequestContext::requestIds( array() ) );
        $bad = expOETiptapAIRequestContext::requestIds( array( 'contentObjectId' => '5 OR 1=1', 'version' => '-3', 'attributeId' => array( '8' ),
                                                               'languageCode' => 'ger-DE"><script>' ) );
        $this->assertSame( $this->ids( 0, 0, 0, null ), $bad, 'a language that is not a code is kept as invalid, not dropped' );
        $this->assertNull( expOETiptapAIRequestContext::requestIds( array( 'languageCode' => "ger-DE\n" ) )['language'] );
        $this->assertSame( 0, expOETiptapAIRequestContext::requestIds( array( 'contentObjectId' => "57\n" ) )['object_id'] );
        $this->assertSame( 0, expOETiptapAIRequestContext::requestIds( array( 'contentObjectId' => '12345678901' ) )['object_id'] );
    }

    public function testADraftOfTheUserWithEditAccessPasses()
    {
        $this->assertSame( $this->ids( 57, 3, 812, 'ger-DE' ), $this->context()->check( $this->ids( 57, 3, 812, 'ger-DE' ) ) );
        $this->assertSame( $this->ids( 57, 5, 812, '' ), $this->context()->check( $this->ids( 57, 5, 812 ) ), 'an internal draft, no language' );
        $this->assertSame( array( array( 3, 'ger-DE' ), array( 5, false ) ), $this->objects[57]->asked, 'editAccess() with the version and the language' );
        $this->assertSame( array(), $this->context()->check( $this->ids( 0, 0 ) ), 'no field named: nothing to check' );
    }

    public function testNoEditAccess()
    {
        $this->objects[57]->allowed = false;
        $this->refused( $this->ids( 57, 3, 812, 'eng-GB' ), '/not allowed to edit this content/' );
        $this->refused( $this->ids( 404, 3 ), '/not allowed to edit this content/' );
    }

    public function testAttributeOfAnotherObject()
    {
        $this->refused( $this->ids( 57, 3, 900 ), '/does not belong to this content/' );
        $this->refused( $this->ids( 57, 3, 901 ), '/does not belong to this content/' );
    }

    public function testVersionOfAnotherObjectOrUser()
    {
        $this->refused( $this->ids( 57, 4, 812 ), '/not a draft of yours/' );      // another user's draft
        $this->refused( $this->ids( 57, 2, 812 ), '/not a draft of yours/' );      // published
        $this->refused( $this->ids( 60, 3, 812 ), '/not a draft of yours/' );      // no version 3 of object 60
        $this->refused( $this->ids( 57, 0, 812 ), '/not a draft of yours/' );      // no version named
        $this->assertSame( array(), $this->objects[57]->asked, 'edit access is not even asked' );
    }

    public function testTheFieldMustBeOfTheRequestedLanguage()
    {
        // 813 is the eng-GB field of object 57: the request names ger-DE
        $e = $this->refused( $this->ids( 57, 3, 813, 'ger-DE' ), '/does not belong to this content/' );
        $this->assertSame( 'language of the attribute and language of the request do not match', $e->getLogDetail() );
        $this->assertSame( $this->ids( 57, 3, 813, 'eng-GB' ), $this->context()->check( $this->ids( 57, 3, 813, 'eng-GB' ) ) );
        $this->assertSame( $this->ids( 57, 3, 813, '' ), $this->context()->check( $this->ids( 57, 3, 813 ) ), 'no language named: any field of the object' );
    }

    public function testAKernelWithoutEditAccessUsesCanEditInTheLanguage()
    {
        $this->objects[57] = new AIRequestContextTestOldKernelObject( 57, array(
            3 => array( 'creator_id' => self::USER, 'status' => eZContentObjectVersion::STATUS_DRAFT ) ) );
        $this->assertFalse( method_exists( $this->objects[57], 'editAccess' ) );
        $this->assertSame( $this->ids( 57, 3, 812, 'ger-DE' ), $this->context()->check( $this->ids( 57, 3, 812, 'ger-DE' ) ) );
        $this->assertSame( $this->ids( 57, 3, 812, '' ), $this->context()->check( $this->ids( 57, 3, 812 ) ) );
        $this->assertSame( array( array( false, false, false, 'ger-DE' ), array( false, false, false, false ) ), $this->objects[57]->asked );
        $this->objects[57]->allowed = false;
        $this->refused( $this->ids( 57, 3, 812, 'ger-DE' ), '/not allowed to edit this content/' );
    }

    public function testInvalidLanguage()
    {
        $this->refused( $this->ids( 57, 3, 812, null ), '/language of the field is not valid/' );
        $this->refused( $this->ids( 57, 3, 812, 'fre-FR' ), '/language of the field is not valid/' );
    }

    public function testADataPolicyNeedsTheObject()
    {
        $this->refused( $this->ids( 0, 0 ), '/data policy needs to know/', true );
        $this->assertSame( $this->ids( 57, 3, 812, '' ), $this->context()->check( $this->ids( 57, 3, 812 ), true ) );
    }

    public function testAProviderWithSetRequestContextGetsTheFieldAndTheCommand()
    {
        $provider = new AIRequestContextTestProvider();
        $service = new expOETiptapAIService( array( 'Enabled' => 'true' ), $provider );
        $service->setRequestContext( $this->ids( 57, 3, 812, 'ger-DE' ) );
        $service->run( 'shorten', 'Some text' );
        $this->assertSame( array( 'command' => 'shorten', 'object_id' => 57, 'version' => 3, 'attribute_id' => 812, 'language' => 'ger-DE' ), $provider->context );
        $this->assertSame( 'openai-compatible', $service->providerName() );
    }

    public function testRefusalsAreLoggedWithoutSecrets()
    {
        $logged = array();
        $service = new expOETiptapAIService( array( 'Enabled' => 'true', 'Provider' => 'expai', 'ApiKey' => 'sk-SECRET' ), null,
                                             static function ( $m ) use ( &$logged ) { $logged[] = $m; } );
        $service->logRefusal( "form token mismatch\ntoken=<abc> key sk-SECRET" );
        $this->assertCount( 1, $logged );
        $this->assertStringStartsWith( 'AI refused provider=expai reason=form token mismatch', $logged[0] );
        $this->assertStringNotContainsString( 'sk-SECRET', $logged[0] );
        $this->assertStringNotContainsString( "\n", $logged[0] );
        $this->assertStringNotContainsString( '<', $logged[0] );
    }
}

/** A content object without a database: versions by number, editAccess() answers $allowed and records its arguments */
class AIRequestContextTestObject
{
    public $allowed = true;
    public $asked = array();
    private $id;
    private $versions;

    public function __construct( $id, array $versions )
    {
        $this->id = $id;
        $this->versions = $versions;
    }

    public function attribute( $name )
    {
        return $name === 'id' ? $this->id : null;
    }

    public function version( $number )
    {
        return isset( $this->versions[$number] ) ? new AIRequestContextTestRow( $this->versions[$number] + array( 'version' => $number ) ) : null;
    }

    public function editAccess( $version, $language = false )
    {
        $this->asked[] = array( (int) $version->attribute( 'version' ), $language );
        return $this->allowed;
    }
}

/** A content object of a kernel without editAccess(): canEdit() answers $allowed and records its arguments */
class AIRequestContextTestOldKernelObject
{
    public $allowed = true;
    public $asked = array();
    private $id;
    private $versions;

    public function __construct( $id, array $versions )
    {
        $this->id = $id;
        $this->versions = $versions;
    }

    public function version( $number )
    {
        return isset( $this->versions[$number] ) ? new AIRequestContextTestRow( $this->versions[$number] + array( 'version' => $number ) ) : null;
    }

    public function canEdit( $originalClassID = false, $parentClassID = false, $returnAccessList = false, $language = false )
    {
        $this->asked[] = array( $originalClassID, $parentClassID, $returnAccessList, $language );
        return $this->allowed;
    }
}

/** A version or attribute row */
class AIRequestContextTestRow
{
    private $values;

    public function __construct( array $values )
    {
        $this->values = $values;
    }

    public function attribute( $name )
    {
        return isset( $this->values[$name] ) ? $this->values[$name] : null;
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
