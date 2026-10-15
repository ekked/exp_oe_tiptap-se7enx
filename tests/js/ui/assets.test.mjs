/**
 * The editor's script and stylesheet links: plain design paths, no version or cache-busting query string.
 *
 * @license GPL-2.0-or-later
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../../..' );

test( 'the editor template links its built files without a version query', () => {
    const tpl = readFileSync( resolve( root, 'design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' ), 'utf8' );
    const links = [ ...tpl.matchAll( /<(?:link|script)\b[^>]*(?:href|src)="([^"]*)"/g ) ].map( ( m ) => m[1] );
    assert.ok( links.length >= 2, 'the link and script tags are found' );
    for ( const url of links )
        assert.ok( !/\?/.test( url ), 'no query string on ' + url );
} );
