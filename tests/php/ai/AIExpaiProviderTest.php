<?php
/**
 * Provider=expai: the AI commands through the extension expai, with expai's settings in memory, a fake model of
 * expai (Type=custom) and a recording stand-in for expai's usage recorder. No database, no network, no expai test
 * files. Skipped when expai is not installed in the root.
 *
 * @license GNU General Public License v2.0 (or any later version)
 */

require_once __DIR__ . '/../bootstrap.php';

use PHPUnit\Framework\TestCase;

final class AIExpaiProviderTest extends TestCase
{
    /** @var string[] the lines the service logged */
    private $logged = array();

    public static function setUpBeforeClass(): void
    {
        // the first eZExtension::activeExtensions() of the process installs the kernel's exception handler: once
        // here, not inside a test
        if ( class_exists( 'eZExtension' ) )
            eZExtension::activeExtensions();
    }

    protected function setUp(): void
    {
        if ( !class_exists( 'expAiConfig' ) || !interface_exists( 'expAiProvider' ) || !class_exists( 'expAiUsageRecorder' ) )
            $this->markTestSkipped( 'expai is not installed in this root' );
        AIExpaiProviderTestModel::$requests = array();
        AIExpaiProviderTestModel::$answers = array();
    }

    /**
     * expai's settings in memory: one provider "fake" (region us, unless given) with the models fake.small and
     * fake.large, fake.small the default, expai switched on.
     */
    private function config( array $more = array(), array $provider = array() )
    {
        $groups = array(
            'AISettings' => array( 'Enabled' => 'true', 'DisabledSiteAccesses' => array(), 'AllowUserModelChoice' => 'disabled' ),
            'ProviderSettings' => array( 'Providers' => array( 'fake' ), 'DefaultModel' => 'fake.small' ),
            'Provider_fake' => $provider + array( 'Type' => 'custom', 'Class' => 'AIExpaiProviderTestModel', 'Label' => 'Fake', 'Region' => 'us', 'Retention' => '30d' ),
            'Model_fake.small' => array( 'Provider' => 'fake', 'Id' => 'fake-small-1' ),
            'Model_fake.large' => array( 'Provider' => 'fake', 'Id' => 'fake-large-2' ),
        );
        foreach ( $more as $group => $values )
            $groups[$group] = $values + ( isset( $groups[$group] ) ? $groups[$group] : array() );
        return new expAiConfig( new AIExpaiProviderTestIni( $groups ) );
    }

    private function provider( expAiConfig $config, array $settings = array(), $object = null )
    {
        $provider = new AIExpaiProviderTestProvider( $settings + array( 'ExpaiModel' => '' ), $config );
        $provider->object = $object;
        return $provider;
    }

    private function service( $provider )
    {
        $this->logged = array();
        $logged = &$this->logged;
        return new expOETiptapAIService( array( 'Enabled' => 'true', 'Provider' => 'expai', 'MaxOutputTokens' => 300 ), $provider,
                                         static function ( $m ) use ( &$logged ) { $logged[] = $m; } );
    }

    /** @return eZContentObject an object without a database: id 5, section 3, class article */
    private function article()
    {
        return new AIExpaiProviderTestObject( array( 'id' => 5, 'contentclass_id' => 2, 'class_identifier' => 'article', 'section_id' => 3 ) );
    }

    private function refused( callable $call, $pattern )
    {
        try
        {
            $call();
            $this->fail( 'expected a refusal matching ' . $pattern );
        }
        catch ( expOETiptapAIException $e )
        {
            $this->assertMatchesRegularExpression( $pattern, $e->getMessage() );
            return $e;
        }
    }

    // ---------------------------------------------------------------- availability

    public function testAvailableOnlyWhenExpaiIsActive()
    {
        $this->assertFalse( expOETiptapAIExpaiProvider::available( array() ) );
        $this->assertFalse( expOETiptapAIExpaiProvider::available( array( 'ezoe', 'exp_oe_tiptap' ) ) );
        $this->assertTrue( expOETiptapAIExpaiProvider::available( array( 'ezoe', 'expai' ) ) );
    }

    public function testProviderExpaiWithoutExpaiIsAConfigurationError()
    {
        $logged = array();
        $service = new expOETiptapAIService( array( 'Enabled' => 'true', 'Provider' => 'expai' ), null,
                                             static function ( $m ) use ( &$logged ) { $logged[] = $m; } );
        if ( expOETiptapAIExpaiProvider::available() )
        {
            $this->assertInstanceOf( 'expOETiptapAIExpaiProvider', $service->provider() );
            return;
        }
        $e = $this->refused( static function () use ( $service ) { $service->run( 'improve', 'Text' ); }, '/not configured correctly/' );
        $this->assertStringContainsString( 'expai is not active', $e->getLogDetail() );
        $this->assertStringContainsString( 'expai is not active', implode( "\n", $logged ) );

        // the provider itself refuses as well
        $provider = new AIExpaiProviderTestProvider( array(), $this->config() );
        $provider->active = false;
        $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/not configured correctly/' );
        $this->assertSame( '', $provider->modelName() );
    }

    public function testCustomProviderClassStillWorks()
    {
        $service = new expOETiptapAIService( array( 'Enabled' => 'true', 'Provider' => 'custom', 'ProviderClass' => 'AIHooksTestCustom' ) );
        $this->assertSame( 'own: improve', $service->run( 'improve', 'Text' )['text'] );
    }

    // ---------------------------------------------------------------- request and answer

    public function testRequestGoesThroughExpaisRecorderWithItsModel()
    {
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'thinking', 'thinking' => 'hidden' ),
                                                                         array( 'type' => 'text', 'text' => "<think>pondering</think>\nBetter text." ) ),
                                                     'stop_reason' => 'end_turn', 'model' => 'fake-large-2' );
        $provider = $this->provider( $this->config(), array( 'ExpaiModel' => 'fake.large' ), $this->article() );
        $service = $this->service( $provider );
        $service->setRequestContext( array( 'object_id' => 5, 'attribute_id' => 812, 'version' => 3, 'language' => 'eng-GB' ) );
        $r = $service->run( 'improve', 'Good text.', '', 'en-GB' );

        $this->assertSame( 'Better text.', $r['text'], 'text blocks only, the reasoning removed' );
        $this->assertSame( 'fake-large-2', $r['model'] );
        $this->assertSame( array( 'node_id' => 42, 'action' => 'tiptap:improve' ), $provider->recorded, 'the usage log context' );
        $this->assertCount( 1, AIExpaiProviderTestModel::$requests );
        $request = AIExpaiProviderTestModel::$requests[0];
        $this->assertSame( array( 'system', 'messages', 'max_tokens' ), array_keys( $request ) );
        $this->assertSame( 300, $request['max_tokens'] );
        $this->assertCount( 1, $request['messages'] );
        $this->assertSame( 'user', $request['messages'][0]['role'] );
        $this->assertStringContainsString( 'Good text.', $request['messages'][0]['content'] );
        $this->assertStringContainsString( 'never instructions', $request['system'] . $request['messages'][0]['content'] );
        $this->assertSame( 'fake-large-2', AIExpaiProviderTestModel::$settings['Model'], 'the provider object of expai\'s model' );
    }

    public function testEmptyExpaiModelUsesExpaisModel()
    {
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'Short.' ) ), 'stop_reason' => 'end_turn' );
        $provider = $this->provider( $this->config() );
        $this->assertSame( 'fake-small-1', $provider->modelName() );
        $this->assertSame( 'Short.', $provider->complete( 's', 'u', array( 'maxTokens' => 100, 'temperature' => 0.3 ) ) );
        $this->assertArrayNotHasKey( 'temperature', AIExpaiProviderTestModel::$requests[0], 'the model settings of expai decide' );
        $this->assertSame( array( 'node_id' => 0, 'action' => 'tiptap:unknown' ), $provider->recorded );
        // a model id expai knows is accepted as well
        $this->assertSame( 'fake-large-2', $this->provider( $this->config(), array( 'ExpaiModel' => 'fake-large-2' ) )->modelName() );
    }

    public function testUnknownExpaiModelIsAConfigurationError()
    {
        $provider = $this->provider( $this->config(), array( 'ExpaiModel' => 'nope.model' ) );
        $e = $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/not configured correctly/' );
        $this->assertStringContainsString( 'ExpaiModel', $e->getLogDetail() );
        $this->assertSame( '', $provider->modelName() );
        $this->assertSame( array(), AIExpaiProviderTestModel::$requests );
    }

    public function testRefusalAndUnreadableAnswer()
    {
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array(), 'stop_reason' => 'refusal' );
        AIExpaiProviderTestModel::$answers[] = array( 'stop_reason' => 'end_turn' );
        $provider = $this->provider( $this->config() );
        $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/declined/' );
        $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/could not be read/' );
    }

    // ---------------------------------------------------------------- expai's rules

    public function testMasterSwitchOfExpaiComesFirst()
    {
        $provider = $this->provider( $this->config( array( 'AISettings' => array( 'Enabled' => 'false' ) ) ), array(), $this->article() );
        $e = $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/switched off/' );
        $this->assertStringContainsString( 'expAiException', $e->getLogDetail() );
        $this->assertNull( $provider->recorded, 'nothing recorded, nothing sent' );
        $this->assertSame( array(), AIExpaiProviderTestModel::$requests );
    }

    public function testDataPolicyDecidesForTheObjectOfTheField()
    {
        $policy = array( 'DataPolicy' => array( 'ClassRegions' => array( 'article' => 'eu;local' ) ) );
        // the provider is in the US: the article must stay in the EU or on the server
        $provider = $this->provider( $this->config( $policy ), array(), $this->article() );
        $e = $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/data policy/' );
        $this->assertStringContainsString( 'Annual report', $e->getMessage() );
        $this->assertSame( array(), AIExpaiProviderTestModel::$requests );

        // a local model may get it
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'ok' ) ) );
        $local = $this->provider( $this->config( $policy, array( 'Region' => 'local' ) ), array(), $this->article() );
        $this->assertSame( 'ok', $local->complete( 's', 'u', array( 'maxTokens' => 100 ) ) );

        // without the object an active policy cannot decide
        $unknown = $this->provider( $this->config( $policy, array( 'Region' => 'local' ) ) );
        $this->refused( static function () use ( $unknown ) { $unknown->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/data policy needs to know/' );

        // without a policy a request without an object is fine
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'fine' ) ) );
        $this->assertSame( 'fine', $this->provider( $this->config() )->complete( 's', 'u', array( 'maxTokens' => 100 ) ) );
    }

    public function testErrorsOfExpaiReachTheEditorWithoutDetails()
    {
        AIExpaiProviderTestModel::$answers[] = new expAiException( 'Your limit of %max tokens per day is used up.', "limit user 7\nsecret <b>detail</b>", 429, array( '%max' => 1000 ) );
        $provider = $this->provider( $this->config() );
        $service = $this->service( $provider );
        $e = $this->refused( static function () use ( $service ) { $service->run( 'shorten', 'CONFIDENTIAL-TEXT' ); }, '/limit of 1000 tokens/' );
        $this->assertSame( 429, $e->getCode() );
        $this->assertStringContainsString( 'expai expAiException HTTP 429', $e->getLogDetail() );
        $this->assertStringNotContainsString( '<b>', $e->getLogDetail() );
        $this->assertStringNotContainsString( "\n", $e->getLogDetail() );
        $this->assertStringNotContainsString( 'CONFIDENTIAL-TEXT', implode( "\n", $this->logged ) . $e->getMessage() . $e->getLogDetail() );
        $this->assertStringContainsString( 'provider=expai', implode( "\n", $this->logged ) );
    }

    public function testWithoutExpaisPolicyNothingIsSent()
    {
        $provider = $this->provider( $this->config(), array(), $this->article() );
        $provider->expaiPolicy = false;
        $e = $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/do not have access to Exponential Intelligence/' );
        $this->assertStringContainsString( 'expai/write', $e->getLogDetail() );
        $this->assertNull( $provider->recorded );
        $this->assertSame( array(), AIExpaiProviderTestModel::$requests );
    }

    public function testOnlyModelsExpaiAllowsTheUser()
    {
        // a configured ExpaiModel the user may not use under expai's rules
        $provider = $this->provider( $this->config(), array( 'ExpaiModel' => 'fake.large' ), $this->article() );
        $provider->allowedModels = array( 'fake.small' );
        $e = $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/may not use the model/' );
        $this->assertStringContainsString( 'fake.large', $e->getLogDetail() );
        // the effective model is checked as well
        $default = $this->provider( $this->config(), array(), $this->article() );
        $default->allowedModels = array();
        $this->refused( static function () use ( $default ) { $default->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/may not use the model/' );
        $this->assertSame( array(), AIExpaiProviderTestModel::$requests );
        // an allowed one goes out
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'ok' ) ) );
        $allowed = $this->provider( $this->config(), array( 'ExpaiModel' => 'fake.large' ), $this->article() );
        $allowed->allowedModels = array( 'fake.small', 'fake.large' );
        $this->assertSame( 'ok', $allowed->complete( 's', 'u', array( 'maxTokens' => 100 ) ) );
    }

    /**
     * The real checks of expai's permissions (hasExpaiPolicy(), mayUseModel() with expAiConfig::mayUseModel()), with
     * only the current user replaced: expai/write decides, and without model choice only expai's site default may be
     * used, also when ExpaiModel names another model.
     */
    public function testTheRealPermissionChecksOfExpai()
    {
        $send = function ( $provider )
        {
            return $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) );
        };
        $wired = function ( $access, $registered = true, array $settings = array() )
        {
            $provider = new AIExpaiProviderTestWired( $settings + array( 'ExpaiModel' => '' ), $this->config() );
            $provider->user = new AIExpaiProviderTestUser( $access, $registered );
            return $provider;
        };

        foreach ( array( array( 'no', true ), array( 'yes', false ) ) as list( $word, $registered ) )
        {
            $provider = $wired( $word, $registered );
            $this->refused( static function () use ( $send, $provider ) { $send( $provider ); }, '/do not have access to Exponential Intelligence/' );
            // an anonymous user is refused before the policy is asked
            $this->assertSame( $registered ? array( 'expai/write' ) : array(), $provider->user->asked );
        }
        $provider = $wired( 'no' );
        $provider->user = null;
        $this->refused( static function () use ( $send, $provider ) { $send( $provider ); }, '/do not have access/' );

        // model choice is off in this config: another model than the site default is not the user's to use
        $other = $wired( 'yes', true, array( 'ExpaiModel' => 'fake.large' ) );
        $e = $this->refused( static function () use ( $send, $other ) { $send( $other ); }, '/may not use the model/' );
        $this->assertStringContainsString( 'fake.large', $e->getLogDetail() );
        $this->assertSame( array(), AIExpaiProviderTestModel::$requests );

        // expai/write limited (any limitation counts) and the site default: sent
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'allowed' ) ) );
        $this->assertSame( 'allowed', $send( $wired( 'limited' ) ) );
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'default' ) ) );
        $this->assertSame( 'default', $send( $wired( 'yes', true, array( 'ExpaiModel' => 'fake.small' ) ) ) );
        $this->assertCount( 2, AIExpaiProviderTestModel::$requests );
    }

    public function testACutOffAnswerIsNotUsed()
    {
        AIExpaiProviderTestModel::$answers[] = array( 'content' => array( array( 'type' => 'text', 'text' => 'Half of the' ) ), 'stop_reason' => 'max_tokens' );
        $provider = $this->provider( $this->config() );
        $e = $this->refused( static function () use ( $provider ) { $provider->complete( 's', 'u', array( 'maxTokens' => 100 ) ); }, '/cut off at the token limit/' );
        $this->assertStringContainsString( 'max_tokens', $e->getLogDetail() );
    }

    public function testDataPolicyActive()
    {
        $this->assertFalse( expOETiptapAIExpaiProvider::dataPolicyActive( $this->config() ) );
        $this->assertTrue( expOETiptapAIExpaiProvider::dataPolicyActive( $this->config( array( 'DataPolicy' => array( 'ClassRegions' => array( 'article' => 'eu' ) ) ) ) ) );
        $this->assertTrue( expOETiptapAIExpaiProvider::dataPolicyActive( $this->config( array( 'DataPolicy' => array( 'ZeroRetention' => 'enabled' ) ) ) ) );
    }

    public function testTheRealProviderWrapsInExpaisUsageRecorder()
    {
        $source = (string) file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/classes/ai/expoetiptapaiexpaiprovider.php' );
        $this->assertStringContainsString( 'return new expAiUsageRecorder( $provider, $context );', $source );
        $this->assertStringContainsString( 'expAiDataPolicy::forProvider(', $source );
        $this->assertStringContainsString( 'expAiGate::switchedOff(', $source );
        $this->assertSame( 'tiptap:fix_spelling', expOETiptapAIExpaiProvider::action( 'fix_spelling' ) );
        $this->assertSame( 'tiptap:dropx', expOETiptapAIExpaiProvider::action( 'drop;x' ) );
    }
}

/** A content object whose name needs no database */
class AIExpaiProviderTestObject extends eZContentObject
{
    public function attribute( $attr, $noFunction = false )
    {
        return $attr === 'name' ? 'Annual report' : parent::attribute( $attr, $noFunction );
    }
}

/** The provider with the kernel and the usage log replaced: no database */
class AIExpaiProviderTestProvider extends expOETiptapAIExpaiProvider
{
    /** @var bool expai active */
    public $active = true;

    /** @var eZContentObject|null the object of the field */
    public $object = null;

    /** @var array|null the context the usage recorder got */
    public $recorded = null;

    protected function isAvailable()
    {
        return $this->active;
    }

    protected function effectiveAlias( expAiConfig $config )
    {
        // expAiConfig::effectiveModel() reads the user's preference (database); the site default is what it returns
        // for a user without a choice
        return $config->model();
    }

    protected function contentObject()
    {
        return $this->object;
    }

    /** @var bool the user has expai/write */
    public $expaiPolicy = true;

    /** @var string[]|null the aliases expai allows the user (null: every model) */
    public $allowedModels = null;

    protected function hasExpaiPolicy()
    {
        return $this->expaiPolicy;
    }

    protected function mayUseModel( expAiConfig $config, $alias )
    {
        return $this->allowedModels === null || in_array( $alias, $this->allowedModels, true );
    }

    protected function mainNodeID( $object )
    {
        return 42;
    }

    protected function recorder( expAiProvider $provider, array $context )
    {
        $this->recorded = $context;
        return $provider;
    }
}

// declared only where expai's interface exists (the tests skip without expai)
if ( interface_exists( 'expAiProvider' ) ) {

/** A model of expai (Provider Type=custom): records the requests, answers from a queue */
class AIExpaiProviderTestModel implements expAiProvider
{
    public static $requests = array();
    public static $answers = array();
    public static $settings = array();

    public function __construct( array $settings )
    {
        self::$settings = $settings;
    }

    public function send( array $request )
    {
        self::$requests[] = $request;
        $answer = array_shift( self::$answers );
        if ( $answer instanceof Exception )
            throw $answer;
        return $answer;
    }

    public function modelName()
    {
        return (string) self::$settings['Model'];
    }

    public function providerId()
    {
        return 'fake';
    }
}

}

/** The provider with expai's real permission checks; only the user, the object and the usage log are replaced */
class AIExpaiProviderTestWired extends expOETiptapAIExpaiProvider
{
    /** @var eZUser|null */
    public $user = null;

    public $recorded = null;

    protected function isAvailable()
    {
        return true;
    }

    protected function currentUser()
    {
        return $this->user;
    }

    protected function effectiveAlias( expAiConfig $config )
    {
        return $config->model();
    }

    protected function contentObject()
    {
        return null;
    }

    protected function recorder( expAiProvider $provider, array $context )
    {
        $this->recorded = $context;
        return $provider;
    }
}

/** A user without a database: hasAccessTo() answers the given access word */
class AIExpaiProviderTestUser extends eZUser
{
    public $asked = array();
    private $word;
    private $registered;

    public function __construct( $word, $registered = true )
    {
        parent::__construct( array( 'contentobject_id' => 77, 'login' => 'editor' ) );
        $this->word = $word;
        $this->registered = $registered;
    }

    public function hasAccessTo( $module, $function = false )
    {
        $this->asked[] = $module . '/' . $function;
        return array( 'accessWord' => $this->word, 'policies' => array() );
    }

    public function isRegistered()
    {
        return $this->registered;
    }
}

/** expai.ini in memory (what expAiConfig and expAiProviderRegistry read of eZINI) */
class AIExpaiProviderTestIni
{
    private $groups;

    public function __construct( array $groups )
    {
        $this->groups = $groups;
    }

    public function hasVariable( $group, $name )
    {
        return isset( $this->groups[$group] ) && array_key_exists( $name, $this->groups[$group] );
    }

    public function variable( $group, $name )
    {
        return $this->hasVariable( $group, $name ) ? $this->groups[$group][$name] : false;
    }

    public function hasGroup( $group )
    {
        return isset( $this->groups[$group] );
    }

    public function group( $group )
    {
        return isset( $this->groups[$group] ) ? $this->groups[$group] : array();
    }

    public function groups()
    {
        return $this->groups;
    }
}

/** Provider=custom with a class of the site, next to Provider=expai */
class AIHooksTestCustom implements expOETiptapAIProvider
{
    public function __construct( array $settings )
    {
    }

    public function complete( $system, $user, array $options )
    {
        return preg_match( '/Task: (\w+)/', $user, $m ) ? 'own: ' . strtolower( $m[1] ) : 'own';
    }

    public function modelName()
    {
        return 'own-model';
    }
}
