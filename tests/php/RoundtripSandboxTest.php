<?php
/**
 * The sandbox of the round trip (tests/php/roundtrip/run.sh <siteaccess> <sandbox> <work-dir>): an SQLite copy or a
 * MySQL database named *_sandbox or *_rt, never the live database of the siteaccess; and run.sh refuses a wrong
 * siteaccess or database name before anything runs. The fixtures directory (run.sh --fixtures=<dir>,
 * EXPOETIPTAP_FIXTURES_DIR) defaults to tests/fixtures/, and the export script refuses to write into it. No database is
 * opened.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/roundtrip/expoetiptaproundtrip.php';

use PHPUnit\Framework\TestCase;

final class RoundtripSandboxTest extends TestCase
{
    private function refused( $value, $implementation, $live, $pattern, array $configured = array() )
    {
        try
        {
            expOETiptapRoundtrip::parseSandbox( $value, $implementation, $live, $configured );
            $this->fail( 'accepted: ' . $value );
        }
        catch ( RuntimeException $e )
        {
            $this->assertMatchesRegularExpression( $pattern, $e->getMessage() );
        }
    }

    public function testMySQLSandboxNames()
    {
        $this->assertSame( array( 'type' => 'mysql', 'database' => 'site_sandbox' ), expOETiptapRoundtrip::parseSandbox( 'mysql:site_sandbox', 'ezmysqli', 'site', array() ) );
        $this->assertSame( array( 'type' => 'mysql', 'database' => 'site_copy_rt' ), expOETiptapRoundtrip::parseSandbox( 'mysql:site_copy_rt', 'ezmysqli', 'site', array() ) );
        $this->refused( 'mysql:site', 'ezmysqli', 'site', '/must end with _sandbox or _rt/' );
        $this->refused( 'mysql:site_live', 'ezmysqli', 'site', '/must end with _sandbox or _rt/' );
        $this->refused( 'mysql:site_sandbox', 'ezmysqli', 'site_sandbox', '/live database/' );
        $this->refused( 'mysql:SITE_sandbox', 'ezmysqli', 'site_sandbox', '/live database/' );
        $this->refused( 'mysql:a-b_sandbox', 'ezmysqli', 'site', '/not a database name/' );
        $this->refused( 'mysql:x_sandbox;drop', 'ezmysqli', 'site', '/not a database name/' );
        $this->refused( 'mysql:', 'ezmysqli', 'site', '/not a database name/' );
    }

    public function testMySQLSandboxThatIsTheDatabaseOfASiteaccessIsRefused()
    {
        $configured = array( 'settings/siteaccess/admin/site.ini.append.php' => array( 'site' ),
                             'settings/siteaccess/test/site.ini.append.php' => array( 'shop_rt' ),
                             'settings/override/site.ini.append.php' => array( 'Main_Sandbox' ) );
        $this->refused( 'mysql:shop_rt', 'ezmysqli', 'site', '#Database of settings/siteaccess/test/site\.ini\.append\.php#', $configured );
        $this->refused( 'mysql:main_sandbox', 'ezmysqli', 'site', '#Database of settings/override/site\.ini\.append\.php#', $configured );
        // also when the siteaccess the round trip runs in is SQLite
        $this->refused( 'mysql:shop_rt', 'sqlite3', 'site.db', '/a live database of the installation/', $configured );
        $this->assertSame( array( 'type' => 'mysql', 'database' => 'site_rt' ),
                           expOETiptapRoundtrip::parseSandbox( 'mysql:site_rt', 'ezmysqli', 'site', $configured ) );
    }

    public function testDatabasesAreReadFromTheDatabaseSettingsBlockOnly()
    {
        $text = "<?php /* #?ini charset=\"utf-8\"?\n\n[SiteSettings]\nDatabase=not_this\n\n[DatabaseSettings]\n"
              . "DatabaseImplementation=ezmysqli\n#Database=commented_out\nDatabase = shop_rt \nDatabase=\n\n"
              . "[OtherSettings]\nDatabase=nor_this\n*/ ?>\n";
        $this->assertSame( array( 'shop_rt' ), expOETiptapRoundtrip::databasesInSiteIni( $text ) );
        $this->assertSame( array(), expOETiptapRoundtrip::databasesInSiteIni( "[DatabaseSettings]\r\nServer=localhost\r\n" ) );
        $this->assertSame( array( 'a', 'b' ), expOETiptapRoundtrip::databasesInSiteIni( "[DatabaseSettings]\nDatabase=a\n[DatabaseSettings]\nDatabase=b\n" ) );
    }

    public function testConfiguredDatabasesScanTheSiteaccessesAndTheOverride()
    {
        $root = sys_get_temp_dir() . '/exp_oe_tiptap_rt_settings_' . getmypid();
        $files = array( 'settings/override/site.ini.append.php' => "[DatabaseSettings]\nDatabase=over_sandbox\n",
                        'settings/siteaccess/one/site.ini.append.php' => "<?php /*\n[DatabaseSettings]\nDatabase=one_rt\n*/ ?>\n",
                        'settings/siteaccess/two/site.ini.append' => "[DatabaseSettings]\nDatabase=two\n",
                        'settings/siteaccess/three/site.ini.append.php' => "[SiteSettings]\nSiteName=x\n",
                        'extension/ext/settings/siteaccess/four/site.ini.append.php' => "[DatabaseSettings]\nDatabase=four_sandbox\n",
                        'settings/siteaccess/one/image.ini.append.php' => "[DatabaseSettings]\nDatabase=not_site_ini\n" );
        try
        {
            foreach ( $files as $file => $text )
            {
                if ( !is_dir( dirname( "$root/$file" ) ) )
                    mkdir( dirname( "$root/$file" ), 0700, true );
                file_put_contents( "$root/$file", $text );
            }
            $found = expOETiptapRoundtrip::configuredDatabases( $root );
            ksort( $found );
            $this->assertSame( array( 'extension/ext/settings/siteaccess/four/site.ini.append.php' => array( 'four_sandbox' ),
                                      'settings/override/site.ini.append.php' => array( 'over_sandbox' ),
                                      'settings/siteaccess/one/site.ini.append.php' => array( 'one_rt' ),
                                      'settings/siteaccess/two/site.ini.append' => array( 'two' ) ), $found );
            $this->refused( 'mysql:ONE_rt', 'ezmysqli', 'site', '/a live database of the installation/', $found );
            $this->refused( 'mysql:four_sandbox', 'ezmysqli', 'site', '/a live database of the installation/', $found );
        }
        finally
        {
            foreach ( array_keys( $files ) as $file )
                @unlink( "$root/$file" );
            foreach ( array( 'settings/siteaccess/one', 'settings/siteaccess/two', 'settings/siteaccess/three',
                             'settings/siteaccess', 'settings/override', 'settings', 'extension/ext/settings/siteaccess/four',
                             'extension/ext/settings/siteaccess', 'extension/ext/settings', 'extension/ext', 'extension', '' ) as $dir )
                @rmdir( rtrim( "$root/$dir", '/' ) );
        }
    }

    public function testMySQLSandboxWithoutTheMarkerTableIsRefused()
    {
        $asked = array();
        try
        {
            expOETiptapRoundtrip::requireSandboxMarker( 'site_rt', static function ( $table ) use ( &$asked )
            {
                $asked[] = $table;
                return false;
            } );
            $this->fail( 'accepted a database without the marker table' );
        }
        catch ( RuntimeException $e )
        {
            $this->assertStringContainsString( "Refusing the database 'site_rt': it has no table exp_oe_tiptap_sandbox", $e->getMessage() );
        }
        $this->assertSame( array( 'exp_oe_tiptap_sandbox' ), $asked );
        expOETiptapRoundtrip::requireSandboxMarker( 'site_rt', static function ( $table )
        {
            return $table === 'exp_oe_tiptap_sandbox';
        } );
        // the marker is checked before the kernel gets the connection
        $source = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/tests/php/roundtrip/expoetiptaproundtrip.php' );
        $use = substr( $source, strpos( $source, 'public static function useSandbox(' ) );
        $this->assertLessThan( strpos( $use, 'eZDB::setInstance( $db )' ), strpos( $use, 'self::requireSandboxMarker(' ) );
    }

    public function testSQLiteSandbox()
    {
        $copy = tempnam( sys_get_temp_dir(), 'exp_oe_tiptap_rt' );
        try
        {
            $this->assertSame( array( 'type' => 'sqlite', 'path' => realpath( $copy ) ), expOETiptapRoundtrip::parseSandbox( $copy, 'ezmysqli', 'site' ) );
            $this->assertSame( 'sqlite', expOETiptapRoundtrip::parseSandbox( $copy, 'sqlite3', 'other.db' )['type'] );
            $this->refused( $copy, 'sqlite3', $copy, '/live database/' );
            $this->refused( basename( $copy ), 'sqlite3', 'other.db', '/absolute path/' );
            $this->refused( $copy . '.missing', 'sqlite3', 'other.db', '/absolute path/' );
            $this->refused( '', 'sqlite3', 'other.db', '/absolute path/' );
        }
        finally
        {
            @unlink( $copy );
        }
    }

    public function testRunShRefusesBeforeAnythingRuns()
    {
        $run = static function ( array $args )
        {
            $process = proc_open( array_merge( array( 'bash', 'extension/exp_oe_tiptap/tests/php/roundtrip/run.sh' ), $args ),
                                  array( 1 => array( 'pipe', 'w' ), 2 => array( 'pipe', 'w' ) ), $pipes, EXP_OE_TIPTAP_TEST_ROOT );
            $out = stream_get_contents( $pipes[1] ) . stream_get_contents( $pipes[2] );
            fclose( $pipes[1] );
            fclose( $pipes[2] );
            return array( proc_close( $process ), $out );
        };
        $work = sys_get_temp_dir() . '/exp_oe_tiptap_rt_never_' . getmypid();
        list( $code, $out ) = $run( array() );
        $this->assertSame( 2, $code );
        $this->assertStringContainsString( '<siteaccess>', $out );
        list( $code, $out ) = $run( array( 'no_such_siteaccess_x', 'mysql:a_sandbox', $work ) );
        $this->assertSame( 2, $code );
        $this->assertStringContainsString( "no siteaccess 'no_such_siteaccess_x'", $out );
        list( $code, $out ) = $run( array( '../x', 'mysql:a_sandbox', $work ) );
        $this->assertSame( 2, $code );
        $this->assertStringContainsString( 'not a siteaccess name', $out );
        $siteaccesses = glob( EXP_OE_TIPTAP_TEST_ROOT . '/settings/siteaccess/*', GLOB_ONLYDIR );
        if ( $siteaccesses )
        {
            list( $code, $out ) = $run( array( basename( $siteaccesses[0] ), 'mysql:live_db', $work ) );
            $this->assertSame( 2, $code );
            $this->assertStringContainsString( 'must end with _sandbox or _rt', $out );
        }
        $this->assertDirectoryDoesNotExist( $work, 'nothing ran' );
    }

    private static function runSh( array $args, array $env = array() )
    {
        $process = proc_open( array_merge( array( 'bash', 'extension/exp_oe_tiptap/tests/php/roundtrip/run.sh' ), $args ),
                              array( 1 => array( 'pipe', 'w' ), 2 => array( 'pipe', 'w' ) ), $pipes, EXP_OE_TIPTAP_TEST_ROOT,
                              $env ? array_merge( getenv(), $env ) : null );
        $out = stream_get_contents( $pipes[1] ) . stream_get_contents( $pipes[2] );
        fclose( $pipes[1] );
        fclose( $pipes[2] );
        return array( proc_close( $process ), $out );
    }

    private static function anySiteaccess()
    {
        $siteaccesses = glob( EXP_OE_TIPTAP_TEST_ROOT . '/settings/siteaccess/*', GLOB_ONLYDIR );
        return $siteaccesses ? basename( $siteaccesses[0] ) : null;
    }

    public function testFixturesDirDefaultsToTheExtensionsFixtures()
    {
        $default = realpath( EXP_OE_TIPTAP_TEST_EXTENSION . '/tests/fixtures' );
        $this->assertSame( $default, expOETiptapRoundtrip::fixturesDir( false ) );
        $this->assertSame( $default, expOETiptapRoundtrip::fixturesDir( '' ) );
        $this->assertSame( realpath( sys_get_temp_dir() ), expOETiptapRoundtrip::fixturesDir( sys_get_temp_dir() ) );
        $this->assertFalse( expOETiptapRoundtrip::fixturesDir( sys_get_temp_dir() . '/exp_oe_tiptap_no_such_dir' ) );
    }

    public function testRunShRefusesAMissingFixturesDirOrTheFixturesDirAsWorkDir()
    {
        $siteaccess = self::anySiteaccess();
        if ( !$siteaccess )
            $this->markTestSkipped( 'no siteaccess under settings/siteaccess/' );
        $work = sys_get_temp_dir() . '/exp_oe_tiptap_rt_never_' . getmypid();
        $missing = sys_get_temp_dir() . '/exp_oe_tiptap_no_such_dir_' . getmypid();
        list( $code, $out ) = self::runSh( array( '--fixtures=' . $missing, $siteaccess, 'mysql:a_rt', $work ) );
        $this->assertSame( 2, $code, $out );
        $this->assertStringContainsString( 'no fixtures directory', $out );
        list( $code, $out ) = self::runSh( array( $siteaccess, 'mysql:a_rt', $work ), array( 'EXPOETIPTAP_FIXTURES_DIR' => $missing ) );
        $this->assertSame( 2, $code, $out );
        $this->assertStringContainsString( 'no fixtures directory', $out );
        $this->assertDirectoryDoesNotExist( $work, 'nothing ran' );

        $fixtures = sys_get_temp_dir() . '/exp_oe_tiptap_rt_fixtures_' . getmypid();
        mkdir( $fixtures );
        try
        {
            list( $code, $out ) = self::runSh( array( '--fixtures=' . $fixtures, $siteaccess, 'mysql:a_rt', $fixtures ) );
            $this->assertSame( 2, $code, $out );
            $this->assertStringContainsString( 'must not be the fixtures directory', $out );
        }
        finally
        {
            rmdir( $fixtures );
        }
    }

    public function testStepOneReadsTheFixturesDirFromTheEnvironment()
    {
        if ( !is_dir( EXP_OE_TIPTAP_TEST_EXTENSION . '/node_modules/happy-dom' ) )
            $this->markTestSkipped( 'needs the extension\'s node_modules (npm ci)' );
        exec( 'node --version 2>/dev/null', $ignored, $status );
        if ( $status !== 0 )
            $this->markTestSkipped( 'needs node' );
        $base = sys_get_temp_dir() . '/exp_oe_tiptap_rt_env_' . getmypid();
        $fixtures = "$base/fixtures";
        $work = "$base/work";
        mkdir( $fixtures, 0777, true );
        file_put_contents( "$fixtures/x001-own.html", '<p>Some <strong>neutral</strong> text.</p>' );
        file_put_contents( "$fixtures/x001-own.xml", '<?xml version="1.0" encoding="utf-8"?><section><paragraph>Some <strong>neutral</strong> text.</paragraph></section>' );
        try
        {
            $command = 'cd ' . escapeshellarg( EXP_OE_TIPTAP_TEST_EXTENSION ) . ' && EXPOETIPTAP_FIXTURES_DIR=' . escapeshellarg( $fixtures )
                     . ' node tests/js/schema/roundtrip.mjs ' . escapeshellarg( $work ) . ' 2>&1';
            exec( $command, $output, $status );
            $this->assertSame( 0, $status, implode( "\n", $output ) );
            $this->assertStringContainsString( 'PASS 1 fixtures of ' . $fixtures, implode( "\n", $output ) );
            $this->assertSame( array( 'x001-own.ezoe.html', 'x001-own.html' ), array_values( array_diff( scandir( $work ), array( '.', '..' ) ) ) );
            $this->assertStringContainsString( '<strong>neutral</strong>', file_get_contents( "$work/x001-own.html" ) );

            $output = array();
            exec( 'cd ' . escapeshellarg( EXP_OE_TIPTAP_TEST_EXTENSION ) . ' && EXPOETIPTAP_FIXTURES_DIR=' . escapeshellarg( $fixtures )
                . ' node tests/js/schema/roundtrip.mjs ' . escapeshellarg( $fixtures ) . ' 2>&1', $output, $status );
            $this->assertSame( 1, $status );
            $this->assertStringContainsString( 'must not be the fixtures directory', implode( "\n", $output ) );
        }
        finally
        {
            foreach ( array_merge( glob( "$fixtures/*" ), glob( "$work/*" ) ) as $file )
                unlink( $file );
            @rmdir( $work );
            rmdir( $fixtures );
            rmdir( $base );
        }
    }

    public function testExporterRefusesTheExtensionsFixturesBeforeReadingAnything()
    {
        $script = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/bin/php/export_roundtrip_fixtures.php' );
        // getOptions() before initialize(), or -s does not choose the database (eZScript reads -s in getOptions)
        $this->assertLessThan( strpos( $script, '$script->initialize()' ), strpos( $script, '$script->getOptions(' ) );
        // the refusal of tests/fixtures/ comes before the first query
        $this->assertLessThan( strpos( $script, '->arrayQuery(' ), strpos( $script, "is the extension's tests/fixtures/" ) );
        $this->assertStringContainsString( "expOETiptapRoundtrip::xmlToEditorHTML( \$xml )", $script, 'the same path as tests/fixtures/' );
    }

    public function testExporterRollsBackWhatInputXMLWrites()
    {
        $script = file_get_contents( EXP_OE_TIPTAP_TEST_EXTENSION . '/bin/php/export_roundtrip_fixtures.php' );
        // inputXML() may create image aliases: the export runs in a transaction that is always rolled back
        $this->assertStringContainsString( "'DatabaseSettings', 'Transactions' ) !== 'enabled'", $script );
        $begin = strpos( $script, '$db->begin();' );
        $this->assertNotFalse( $begin );
        $this->assertLessThan( strpos( $script, '->arrayQuery(' ), $begin, 'the transaction is open before the first query' );
        $this->assertMatchesRegularExpression( '/\}\s*finally\s*\{[^}]*\$db->rollback\(\);/', $script, 'rolled back in finally' );
        $this->assertStringNotContainsString( '$db->commit()', $script );
        $this->assertStringNotContainsString( 'nothing is written', $script, 'no claim that the export writes nothing' );
    }

    public function testRunShFindsASiteaccessThatOnlyAnExtensionDefines()
    {
        $own = array_map( 'basename', glob( EXP_OE_TIPTAP_TEST_ROOT . '/settings/siteaccess/*', GLOB_ONLYDIR ) ?: array() );
        $extensionOnly = array_values( array_diff( array_map( 'basename', glob( EXP_OE_TIPTAP_TEST_ROOT . '/extension/*/settings/siteaccess/*', GLOB_ONLYDIR ) ?: array() ), $own ) );
        if ( !$extensionOnly )
            $this->markTestSkipped( 'no siteaccess that only extension/*/settings/siteaccess/ defines' );
        $work = sys_get_temp_dir() . '/exp_oe_tiptap_rt_never_' . getmypid();
        // the siteaccess is accepted, so the next check (the sandbox name) is the one that refuses
        list( $code, $out ) = self::runSh( array( $extensionOnly[0], 'mysql:live_db', $work ) );
        $this->assertSame( 2, $code, $out );
        $this->assertStringNotContainsString( 'no siteaccess', $out );
        $this->assertStringContainsString( 'must end with _sandbox or _rt', $out );
        $this->assertDirectoryDoesNotExist( $work, 'nothing ran' );
    }

    public function testSQLiteLiveFileIsKnownByDeviceAndInode()
    {
        $dir = sys_get_temp_dir() . '/exp_oe_tiptap_rt_same_' . getmypid();
        mkdir( $dir );
        $live = "$dir/live.db";
        file_put_contents( $live, 'x' );
        $copy = "$dir/copy.db";
        file_put_contents( $copy, 'x' );
        try
        {
            $this->assertTrue( expOETiptapRoundtrip::isSameFile( $live, $live ) );
            $this->assertFalse( expOETiptapRoundtrip::isSameFile( $live, $copy ), 'a copy with the same content is another file' );
            $this->assertFalse( expOETiptapRoundtrip::isSameFile( $live, "$dir/missing.db" ) );
            link( $live, "$dir/hard.db" );
            symlink( $live, "$dir/soft.db" );
            $this->assertTrue( expOETiptapRoundtrip::isSameFile( "$dir/hard.db", $live ) );
            $this->assertTrue( expOETiptapRoundtrip::isSameFile( "$dir/soft.db", $live ) );
            $upper = "$dir/LIVE.db";
            if ( is_file( $upper ) ) // a case insensitive file system: another spelling of the same file
                $this->assertTrue( expOETiptapRoundtrip::isSameFile( $upper, $live ) );
        }
        finally
        {
            foreach ( glob( "$dir/*" ) as $file )
                unlink( $file );
            rmdir( $dir );
        }
    }
}
