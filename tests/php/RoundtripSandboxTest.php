<?php
/**
 * The sandbox of the round trip (tests/php/roundtrip/run.sh <siteaccess> <sandbox> <work-dir>): an SQLite copy or a
 * MySQL database named *_sandbox or *_rt, never the live database of the siteaccess; and run.sh refuses a wrong
 * siteaccess or database name before anything runs. No database is opened.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/roundtrip/expoetiptaproundtrip.php';

use PHPUnit\Framework\TestCase;

final class RoundtripSandboxTest extends TestCase
{
    private function refused( $value, $implementation, $live, $pattern )
    {
        try
        {
            expOETiptapRoundtrip::parseSandbox( $value, $implementation, $live );
            $this->fail( 'accepted: ' . $value );
        }
        catch ( RuntimeException $e )
        {
            $this->assertMatchesRegularExpression( $pattern, $e->getMessage() );
        }
    }

    public function testMySQLSandboxNames()
    {
        $this->assertSame( array( 'type' => 'mysql', 'database' => 'site_sandbox' ), expOETiptapRoundtrip::parseSandbox( 'mysql:site_sandbox', 'ezmysqli', 'site' ) );
        $this->assertSame( array( 'type' => 'mysql', 'database' => 'site_copy_rt' ), expOETiptapRoundtrip::parseSandbox( 'mysql:site_copy_rt', 'ezmysqli', 'site' ) );
        $this->refused( 'mysql:site', 'ezmysqli', 'site', '/must end with _sandbox or _rt/' );
        $this->refused( 'mysql:site_live', 'ezmysqli', 'site', '/must end with _sandbox or _rt/' );
        $this->refused( 'mysql:site_sandbox', 'ezmysqli', 'site_sandbox', '/live database/' );
        $this->refused( 'mysql:SITE_sandbox', 'ezmysqli', 'site_sandbox', '/live database/' );
        $this->refused( 'mysql:a-b_sandbox', 'ezmysqli', 'site', '/not a database name/' );
        $this->refused( 'mysql:x_sandbox;drop', 'ezmysqli', 'site', '/not a database name/' );
        $this->refused( 'mysql:', 'ezmysqli', 'site', '/not a database name/' );
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
}
