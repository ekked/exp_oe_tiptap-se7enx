<?php
/**
 * The extension's templates use only template operators that are registered: an unknown operator writes
 * "Operator '...' is not registered" to warning.log on every page and yields nothing, so the check it was part of
 * silently fails.
 *
 * The registered operators are read from the operator lists of the kernel, the template library and every
 * extension's autoloads/eztemplateautoload.php ('operator_names'), plus the template library's built-in operators.
 * Nothing is booted.
 *
 * @license GPL-2.0-or-later
 */
use PHPUnit\Framework\TestCase;

class TemplateOperatorsTest extends TestCase
{
    /** Operators of eZTemplate itself (no autoload entry) */
    protected static $builtin = array( 'is_set', 'is_unset', 'not', 'and', 'or', 'ne', 'eq', 'gt', 'ge', 'lt', 'le', 'true', 'false' );

    protected static function registeredOperators(): array
    {
        $root = EXP_OE_TIPTAP_TEST_ROOT;
        $files = array_merge( array( $root . '/lib/eztemplate/classes/eztemplateautoload.php', $root . '/kernel/common/eztemplateautoload.php' ),
                              glob( $root . '/extension/*/autoloads/eztemplateautoload.php' ) ?: array() );
        $names = self::$builtin;
        foreach ( $files as $file )
        {
            if ( !is_file( $file ) )
                continue;
            // the lists are plain array literals; read them without running the files
            if ( preg_match_all( "~'operator_names'\s*=>\s*array\s*\(([^)]*)\)~s", (string) file_get_contents( $file ), $m ) )
            {
                foreach ( $m[1] as $list )
                {
                    preg_match_all( "~'([A-Za-z0-9_]+)'~", $list, $n );
                    $names = array_merge( $names, $n[1] );
                }
            }
        }
        return array_unique( $names );
    }

    public function testTheRegisteredOperatorsAreFound()
    {
        $names = self::registeredOperators();
        foreach ( array( 'ezini', 'ezini_hasvariable', 'json_encode', 'wash', 'concat', 'hash', 'is_set' ) as $name )
            $this->assertContains( $name, $names );
        $this->assertNotContains( 'has_attribute', $names );
    }

    public function testEveryOperatorTheTemplatesUseIsRegistered()
    {
        $names = self::registeredOperators();
        $templates = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( EXP_OE_TIPTAP_TEST_EXTENSION . '/design', FilesystemIterator::SKIP_DOTS ) );
        $checked = 0;
        foreach ( $templates as $file )
        {
            if ( substr( $file->getFilename(), -4 ) !== '.tpl' )
                continue;
            $source = (string) file_get_contents( $file->getPathname() );
            // template code only: comments and literal blocks out
            $source = preg_replace( '~\{\*.*?\*\}~s', '', $source );
            $source = preg_replace( '~\{literal\}.*?\{/literal\}~s', '', $source );
            preg_match_all( '~\{[^{}]*\}~', $source, $tags );
            foreach ( $tags[0] as $tag )
            {
                // name( or |name, outside quoted strings
                $code = preg_replace( '~"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'~', "''", $tag );
                preg_match_all( '~(?:\|\s*|(?<![\w$.\]-]))([a-z][a-z0-9_]*)\s*(?=\(|[\s|)},]|$)~', $code, $m, PREG_SET_ORDER );
                foreach ( $m as $match )
                {
                    $name = $match[1];
                    $piped = strpos( $match[0], '|' ) === 0;
                    $called = (bool) preg_match( '~\b' . preg_quote( $name, '~' ) . '\s*\(~', $code );
                    if ( !$piped && !$called )
                        continue;
                    if ( in_array( $name, array( 'def', 'set', 'if', 'elseif', 'else', 'foreach', 'undef', 'include', 'default', 'let', 'section', 'while', 'do', 'for', 'switch', 'case', 'append', 'run', 'cache', 'delimiter', 'skip', 'break', 'continue', 'as', 'sequence', 'loop', 'literal', 'ldelim', 'rdelim', 'block', 'set', 'tool_bar', 'menu', 'attribute_view_gui', 'attribute_edit_gui', 'node_view_gui', 'content_view_gui', 'content_pdf_gui', 'ezscript_require', 'ezcss_require', 'ezscript_load', 'ezcss_load', 'ezscript', 'ezcss' ) ) && !$called )
                        continue;
                    $first = (bool) preg_match( '~^\{/?\s*' . preg_quote( $name, '~' ) . '\b~', $code );
                    if ( $first )
                        continue; // a template function: {def ...}, {include ...}, {ezscript_require( ... )}
                    $this->assertContains( $name, $names, $file->getFilename() . ': ' . trim( $tag ) );
                    $checked++;
                }
            }
        }
        $this->assertGreaterThan( 10, $checked );
    }
}
