/**
 * The ezoe dialogs for Tiptap: link, anchor, embed (image/object/file with search, browse, bookmarks
 * and upload), custom tag, table, table row, table cell, literal, tag properties (class and custom attributes of paragraphs,
 * headings, lists and strong / emphasize), special characters and help.
 *
 * They call ezoe's own server side (ezoe-api.js) and produce the ezoe HTML dialect, exactly the
 * markup eZOEXMLInput writes and eZOEInputParser reads. The markup goes into Tiptap through the
 * schema's own parse rules (insertContent / attrsFromElement), so the dialogs never depend on the
 * node and attribute names of the schema.
 */
import { DOMSerializer as Serializer } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { TableMap, CellSelection } from '@tiptap/pm/tables';
import { h, clear } from './dom.js';
import { openDialog, field, select } from './dialog.js';
import { EzoeApi, PAGE_SIZE, parseCustomAttributes, serializeCustomAttributes, decodeHtml } from './ezoe-api.js';
import {
    linkMark, markForTag, nodeForTag, selectedAncestor, attrsFromElement, dialectElement, makeElement, escapeHtml
} from '../editor/schema-utils.js';
import { setBlockFormat } from '../editor/commands.js';
import { generalTargets, preferredTarget, TAG_LABELS } from '../editor/tags.js';
import { helpContent, SHORTCUTS } from './help.js';
import { readSource, applySource } from '../editor/source.js';


const EMBED_ID = /^eZ(Object|Node)_(\d+)$/;

// ---------------------------------------------------------------- helpers

/** openDialog() with the editor's skin and close text; closing gives the focus back to the text */
function open( ctx, spec ) {
    return openDialog( Object.assign( {
        skin: ctx.options.skin, closeText: ctx.t( 'Close' ),
        returnFocus: () => {
            // at once, not in the next frame as commands.focus() does: no frame comes in a hidden tab
            if ( ctx.editor && !ctx.editor.isDestroyed )
                ctx.editor.view.focus();
        }
    }, spec ) );
}

function dialect( ctx, nodeOrMark ) {
    return dialectElement( ctx.editor, nodeOrMark, ( el ) => ctx.schema.cleanup( el ), Serializer );
}

/** Inserts ezoe dialect HTML at the selection (or over range) through the schema's parser */
export function insertDialectHTML( ctx, html, range ) {
    let content = ctx.schema.parseFragment( html, ctx.editor.schema );
    // inline markup (link text, anchor, inline embed or custom tag) is parsed into a paragraph of its own:
    // insert only the paragraph's content so it lands inside the current paragraph
    const holder = document.createElement( 'div' );
    holder.innerHTML = html;
    const first = holder.firstElementChild;
    const inline = !first || !/^(P|DIV|PRE|H[1-6]|UL|OL|TABLE)$/.test( first.tagName ) && !( first.tagName === 'IMG' && first.getAttribute( 'inline' ) === 'false' && !/ezoeItemCustomTag/.test( first.className ) );
    if ( inline && Array.isArray( content ) && content.length === 1 && content[0].type === 'paragraph' &&
         Object.values( content[0].attrs || {} ).every( ( v ) => v === null || v === undefined || v === '' ) )
        content = content[0].content || [];
    const chain = ctx.editor.chain().focus();
    return range ? chain.insertContentAt( range, content ).run() : chain.insertContent( content ).run();
}

/** Selected text, for inline wrappers */
function selectedText( editor ) {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween( from, to, '\n' );
}

/** Selected content as editor HTML, for block wrappers */
function selectedHTML( editor ) {
    const { selection } = editor.state;
    if ( selection.empty )
        return '';
    const fragment = Serializer.fromSchema( editor.schema ).serializeFragment( selection.content().content );
    const holder = document.createElement( 'div' );
    holder.appendChild( fragment );
    return holder.innerHTML;
}

function classOptions( t, classes ) {
    const list = [ [ '', t( '-- Not set --' ) ] ];
    if ( Array.isArray( classes ) )
        classes.forEach( ( c ) => list.push( [ c, c ] ) );
    else
        Object.keys( classes || {} ).forEach( ( c ) => list.push( [ c, classes[c] || c ] ) );
    return list;
}

function cleanClass( value ) {
    return String( value || '' ).replace( /\b(ezoeItem\w+|ezoeAlign\w+|mceItem\w+|mceVisualAid)\b/g, '' ).replace( /\s+/g, ' ' ).trim();
}

/** Form controls for custom attribute definitions (eZOEXMLInput::getCustomAttributeDefinitions()) */
function attributeFields( t, definitions, stored ) {
    const controls = {};
    const rows = ( definitions || [] ).map( ( a ) => {
        const value = stored[a.id] !== undefined ? stored[a.id] : ( a['default'] || '' );
        let control;
        if ( a.type === 'select' ) {
            const opts = Object.keys( a.selection || {} ).map( ( k ) => [ k === '-0-' ? '' : k, t( a.selection[k] ) ] );
            control = select( opts.length ? opts : [ [ '', '' ] ], value );
        } else if ( a.type === 'checkbox' ) {
            control = h( 'input', { type: 'checkbox', checked: value !== '' && value !== 'false' && value !== undefined } );
        } else if ( a.type === 'textarea' ) {
            control = h( 'textarea', { rows: a.rows || 3 } );
            control.value = value;
        } else {
            control = h( 'input', { type: a.type === 'int' || a.type === 'number' ? 'number' : 'text', value } );
        }
        control.disabled = !!a.disabled;
        controls[a.id] = { def: a, control };
        // the names and descriptions of ezoe_attributes.ini, translated where the editor knows them (Summary (WAI) ...)
        return field( t( a.name ), control, a.title ? t( a.title ) : '', { required: !!a.required } );
    } );
    const read = () => {
        const values = {};
        for ( const [ id, { def, control } ] of Object.entries( controls ) ) {
            let v = def.type === 'checkbox' ? ( control.checked ? ( String( def['default'] || '' ).trim() || '1' ) : '' ) : String( control.value ).trim();
            if ( def.required && v === '' )
                throw new Error( t( 'Please fill in: %s' ).replace( '%s', t( def.name ) ) );
            if ( v !== '' && def.type === 'int' && !/^-?\d+$/.test( v ) )
                throw new Error( t( 'Please enter a whole number: %s' ).replace( '%s', t( def.name ) ) );
            if ( v !== '' && def.type === 'number' && !/^-?\d+([.,]\d+)?$/.test( v ) )
                throw new Error( t( 'Please enter a number: %s' ).replace( '%s', t( def.name ) ) );
            if ( v !== '' && def.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test( v ) )
                throw new Error( t( 'Please enter an e-mail address: %s' ).replace( '%s', t( def.name ) ) );
            values[id] = v;
        }
        return values;
    };
    return { rows, read };
}

// ---------------------------------------------------------------- content picker (search, browse, bookmarks)

/**
 * The list of ezoe's dialogs: Search, Browse and Bookmarks tabs, a table with radio, name and class,
 * PAGE_SIZE entries per page. onPick( item ) gets the ezjscAjaxContent item.
 */
function contentPicker( ctx, api, onPick ) {
    const { t, options } = ctx;
    const status = h( 'div', { class: 'exp-oe-picker-status', 'aria-live': 'polite' } );
    const list = h( 'div', { class: 'exp-oe-picker-list' } );
    const query = h( 'input', { type: 'search', placeholder: t( 'Search' ), 'aria-label': t( 'Search' ) } );
    const pathBar = h( 'div', { class: 'exp-oe-picker-path' } );
    let mode = 'search', lastQuery = '', node = options.browseRoots && options.browseRoots[0] ? options.browseRoots[0].node_id : ( options.rootNode || 2 );

    const show = ( result, reload ) => {
        clear( list );
        clear( pathBar );
        if ( result.node && Array.isArray( result.node.path ) ) {
            result.node.path.concat( [ result.node ] ).forEach( ( n, i, all ) => {
                if ( i )
                    pathBar.appendChild( document.createTextNode( ' / ' ) );
                pathBar.appendChild( i === all.length - 1 ? h( 'strong', { text: decodeHtml( n.name ) } )
                    : h( 'a', { href: '#', text: decodeHtml( n.name ), onclick: ( e ) => { e.preventDefault(); node = n.node_id; load( 0 ); } } ) );
            } );
        }
        if ( !result.items.length ) {
            list.appendChild( h( 'p', { class: 'exp-oe-empty', text: t( 'No results' ) } ) );
            return;
        }
        const name = 'exp-oe-pick-' + Math.random().toString( 36 ).slice( 2 );
        const rows = result.items.map( ( item ) => h( 'tr', {}, [
            h( 'td', {}, h( 'input', { type: 'radio', name, 'aria-label': decodeHtml( item.name ), onchange: () => onPick( item ) } ) ),
            h( 'td', {}, mode === 'browse' && item.children_count
                ? h( 'a', { href: '#', text: decodeHtml( item.name ), onclick: ( e ) => { e.preventDefault(); node = item.node_id; load( 0 ); } } )
                : decodeHtml( item.name ) ),
            h( 'td', { class: 'exp-oe-picker-class', text: decodeHtml( item.class_name || '' ) } )
        ] ) );
        list.appendChild( h( 'table', { class: 'exp-oe-picker-table' }, h( 'tbody', {}, rows ) ) );
        if ( result.total > PAGE_SIZE ) {
            const from = result.offset + 1, to = Math.min( result.offset + PAGE_SIZE, result.total );
            list.appendChild( h( 'div', { class: 'exp-oe-picker-paging' }, [
                result.offset > 0 ? h( 'a', { href: '#', text: '<< ' + t( 'Previous' ), onclick: ( e ) => { e.preventDefault(); reload( Math.max( 0, result.offset - PAGE_SIZE ) ); } } ) : h( 'span' ),
                h( 'span', { text: t( '%1 to %2 of %3' ).replace( '%1', from ).replace( '%2', to ).replace( '%3', result.total ) } ),
                to < result.total ? h( 'a', { href: '#', text: t( 'Next' ) + ' >>', onclick: ( e ) => { e.preventDefault(); reload( result.offset + PAGE_SIZE ); } } ) : h( 'span' )
            ] ) );
        }
    };

    const load = ( offset ) => {
        status.textContent = t( 'Loading...' );
        let p;
        if ( mode === 'search' )
            p = lastQuery ? api.search( lastQuery, offset ) : Promise.resolve( { items: [], total: 0, offset: 0 } );
        else if ( mode === 'browse' )
            p = api.browse( node, offset );
        else
            p = api.bookmarks( offset );
        return p.then( ( r ) => {
            status.textContent = '';
            show( r, load );
        }, ( e ) => {
            status.textContent = e.message;
        } );
    };

    const tabs = h( 'div', { class: 'exp-oe-tabs', role: 'tablist', 'aria-label': t( 'Choose content' ) } );
    const searchRow = h( 'div', { class: 'exp-oe-picker-search' }, [
        query, h( 'button', { type: 'button', class: 'exp-oe-dialog-button', text: t( 'Search' ), onclick: () => { lastQuery = query.value.trim(); load( 0 ); } } )
    ] );
    query.addEventListener( 'keydown', ( e ) => {
        if ( e.key === 'Enter' ) {
            e.preventDefault();
            e.stopPropagation();
            lastQuery = query.value.trim();
            load( 0 );
        }
    } );
    const setMode = ( m ) => {
        mode = m;
        for ( const b of tabs.children )
            b.setAttribute( 'aria-selected', b.getAttribute( 'data-mode' ) === m ? 'true' : 'false' );
        searchRow.hidden = m !== 'search';
        pathBar.hidden = m !== 'browse';
        clear( list );
        if ( m !== 'search' )
            load( 0 );
    };
    for ( const [ m, label ] of [ [ 'search', 'Search' ], [ 'browse', 'Browse' ], [ 'bookmarks', 'Bookmarks' ] ] )
        tabs.appendChild( h( 'button', { type: 'button', role: 'tab', class: 'exp-oe-tab', 'data-mode': m, text: t( label ), onclick: () => setMode( m ) } ) );
    const element = h( 'div', { class: 'exp-oe-picker' }, [ tabs, searchRow, pathBar, status, list ] );
    setMode( 'search' );
    return { element };
}

// ---------------------------------------------------------------- link

function linkDialog( ctx ) {
    const { editor, t, options } = ctx;
    const mark = linkMark( editor );
    if ( !mark )
        return;
    const api = new EzoeApi( options, ctx.fetch );
    const active = editor.isActive( mark.name );
    let el = null;
    if ( active ) {
        editor.chain().extendMarkRange( mark.name ).run();
        const m = editor.state.selection.$from.marks().find( ( x ) => x.type === mark.type ) ||
                  editor.state.doc.resolve( editor.state.selection.from + 1 ).marks().find( ( x ) => x.type === mark.type );
        el = m ? dialect( ctx, m ) : null;
    }
    const get = ( a ) => ( el && el.getAttribute( a ) ) || '';
    const stored = parseCustomAttributes( get( 'customattributes' ) );
    const href = h( 'input', { type: 'text', value: get( 'href' ), placeholder: 'https://, eznode://, ezobject://, mailto:, #anchor', autofocus: true } );
    const target = select( [ [ '', t( '-- Not set --' ) ], [ '_blank', t( 'Open in new window' ) ] ], get( 'target' ) );
    const title = h( 'input', { type: 'text', value: get( 'title' ) } );
    const id = h( 'input', { type: 'text', value: get( 'id' ) } );
    const cls = select( classOptions( t, options.linkClasses ), cleanClass( get( 'class' ) ) );
    const view = select( [ [ '', t( 'Default' ) ] ].concat( ( options.linkViewModes || [] ).map( ( v ) => [ v, v ] ) ), get( 'view' ) );
    const linkDef = ( options.generalDefinitions && options.generalDefinitions.link ) || {};
    const custom = attributeFields( t, linkDef.attributes, stored );
    const picker = contentPicker( ctx, api, ( item ) => {
        href.value = 'eznode://' + item.node_id;
        if ( !title.value )
            title.value = decodeHtml( item.name );
    } );
    const pickerBox = h( 'details', { class: 'exp-oe-link-picker' }, [ h( 'summary', { text: t( 'Choose content' ) } ), picker.element ] );

    open( ctx, {
        title: active ? t( 'Edit link' ) : t( 'Insert link' ), width: 560,
        description: t( 'Address and attributes of the link.' ),
        body: [ field( t( 'URL' ), href, t( 'Leave empty to remove the link.' ) ), pickerBox, field( t( 'Target' ), target ), field( t( 'Title' ), title ),
                field( t( 'Class' ), cls ), field( t( 'View' ), view ), field( t( 'ID' ), id ) ].concat( custom.rows ),
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const url = href.value.trim();
                if ( !url ) {
                    if ( active )
                        editor.chain().focus().extendMarkRange( mark.name ).unsetMark( mark.name ).run();
                    return true;
                }
                const a = makeElement( 'a', {
                    href: url, target: target.value, title: title.value.trim(), 'class': cls.value, view: view.value, id: id.value.trim(),
                    customattributes: serializeCustomAttributes( custom.read() )
                } );
                const attrs = attrsFromElement( mark.type, a ) || { href: url };
                const chain = editor.chain().focus();
                if ( active )
                    chain.extendMarkRange( mark.name );
                if ( editor.state.selection.empty && !active ) {
                    // nothing selected: insert the address as linked text
                    a.textContent = title.value.trim() || url;
                    return insertDialectHTML( ctx, a.outerHTML );
                }
                return chain.setMark( mark.name, attrs ).run();
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

// ---------------------------------------------------------------- anchor

function anchorDialog( ctx ) {
    const { editor, t } = ctx;
    const sel = editor.state.selection;
    const existing = sel instanceof NodeSelection && /anchor/i.test( sel.node.type.name ) ? sel.node : null;
    const el = existing ? dialect( ctx, existing ) : null;
    const name = h( 'input', { type: 'text', value: el ? el.getAttribute( 'name' ) || '' : '', autofocus: true } );
    open( ctx, {
        title: t( 'Insert/edit anchor' ), width: 360,
        description: t( 'A name links can point to with #name.' ),
        body: [ field( t( 'Anchor name' ), name, t( 'Starts with a letter; then letters, digits, -, _, : and . only.' ), { required: true } ) ],
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const v = name.value.trim();
                if ( !/^[A-Za-z][\w\-:.]*$/.test( v ) )
                    throw new Error( t( 'Please enter a valid anchor name' ) );
                const html = makeElement( 'a', { name: v, 'class': 'mceItemAnchor' } ).outerHTML;
                return insertDialectHTML( ctx, html, existing ? { from: sel.from, to: sel.to } : null );
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

// ---------------------------------------------------------------- embed

function contentTypeOf( options, classIdentifier ) {
    const groups = options.relationGroups || { images: [ 'image' ], files: [ 'file' ] };
    for ( const g of Object.keys( groups ) ) {
        if ( ( groups[g] || [] ).indexOf( classIdentifier ) !== -1 )
            return g;
    }
    return options.relationDefaultGroup || 'objects';
}

function imageAlias( object, size ) {
    const attr = object.image_attributes && object.image_attributes[0];
    const content = attr && object.data_map && object.data_map[attr] && object.data_map[attr].content;
    if ( !content || typeof content !== 'object' )
        return null;
    return content[size] || content.original || null;
}

/** ezoe dialect HTML of an embed, like eZOEXMLInput writes it (see the TinyMCE 8 ezembed plugin) */
export function buildEmbedHTML( ctx, api, embedId, data ) {
    const { options } = ctx;
    const inline = !!data.inline, size = data.size || options.defaultSize || 'medium';
    const view = data.view || ( inline ? 'embed-inline' : 'embed' );
    return api.loadObject( embedId, size ).then( ( object ) => {
        if ( !object )
            throw new Error( ctx.t( 'Object not found or access denied' ) + ': ' + embedId );
        const type = contentTypeOf( options, object.class_identifier );
        let classes = cleanClass( data.cssClass );
        const attrs = {
            id: embedId, title: decodeHtml( object.name ), alt: size, view, inline: inline ? 'true' : 'false',
            customattributes: data.customAttributes || null
        };
        if ( type === 'images' && !options.compatibilityMode ) {
            const alias = imageAlias( object, size ) || {};
            let src = alias.url || options.attachmentIcon || '';
            if ( src && !/^(https?:)?\//.test( src ) )
                src = ( ( options.urls && options.urls.root ) || '/' ) + src;
            attrs.src = src;
            attrs.width = alias.width || 32;
            attrs.height = alias.height || 32;
            attrs.align = data.align === 'center' ? 'middle' : data.align;
            if ( attrs.align )
                classes = ( classes + ' ezoeAlign' + attrs.align ).trim();
            attrs['class'] = classes;
            return makeElement( 'img', attrs ).outerHTML;
        }
        attrs.align = data.align;
        attrs['class'] = ( 'ezoeItemNonEditable ' + classes + ' ezoeItemContentType' + type.charAt( 0 ).toUpperCase() + type.slice( 1 ) ).replace( /\s+/g, ' ' );
        return api.embedView( embedId, { inline: inline ? 'true' : 'false', size, view, align: data.align || 'none', 'class': data.cssClass || '' } )
            .then( ( inner ) => makeElement( inline ? 'span' : 'div', attrs, inner || escapeHtml( attrs.title ) ).outerHTML );
    } );
}

/** The selected embed node, { node, pos, el } or null */
function selectedEmbed( ctx ) {
    const found = selectedAncestor( ctx.editor, ( n ) => {
        if ( /embed/i.test( n.type.name ) )
            return true;
        return typeof n.attrs.id === 'string' && EMBED_ID.test( n.attrs.id );
    } );
    if ( !found )
        return null;
    found.el = dialect( ctx, found.node );
    return found;
}

function embedDialog( ctx, contentType ) {
    const { t, options } = ctx;
    const api = new EzoeApi( options, ctx.fetch );
    const existing = selectedEmbed( ctx );
    const el = existing && existing.el;
    const get = ( a ) => ( el && el.getAttribute( a ) ) || '';
    let embedId = get( 'id' ) && EMBED_ID.test( get( 'id' ) ) ? get( 'id' ) : '';
    const chosen = h( 'div', { class: 'exp-oe-embed-chosen', 'aria-live': 'polite', text: embedId ? get( 'title' ) + ' (' + embedId + ')' : t( 'Nothing chosen yet' ) } );
    const choose = ( id, name ) => {
        embedId = id;
        chosen.textContent = decodeHtml( name ) + ' (' + id + ')';
    };
    const picker = contentPicker( ctx, api, ( item ) => choose( 'eZObject_' + item.contentobject_id, item.name ) );

    // upload, like ezoe's upload dialog (ezoe/upload/<object>/<version>/auto/1)
    const file = h( 'input', { type: 'file' } );
    const upName = h( 'input', { type: 'text' } );
    const upDesc = h( 'input', { type: 'text' } );
    const upStatus = h( 'div', { class: 'exp-oe-hint' } );
    const uploadBox = h( 'details', { class: 'exp-oe-embed-upload' }, [
        h( 'summary', { text: t( 'Upload new file' ) } ),
        field( t( 'File' ), file ), field( t( 'Name' ), upName ), field( t( 'Description' ), upDesc ),
        h( 'button', { type: 'button', class: 'exp-oe-dialog-button', text: t( 'Upload' ), onclick: () => {
            if ( !file.files || !file.files[0] ) {
                upStatus.textContent = t( 'Please choose a file.' );
                return;
            }
            upStatus.textContent = t( 'Uploading...' );
            api.upload( file.files[0], { name: upName.value, description: upDesc.value, alternativeText: upDesc.value } ).then( ( r ) => {
                upStatus.textContent = t( 'Uploaded' ) + ': ' + r.name;
                choose( 'eZObject_' + r.objectId, r.name );
            }, ( e ) => {
                upStatus.textContent = e.message;
            } );
        } } ), upStatus
    ] );

    const inline = get( 'inline' ) === 'true';
    const defs = options.embedDefinitions || {};
    const def = defs[inline ? 'embed-inline' : 'embed'] || {};
    const sizes = ( options.imageSizes || [ 'small', 'medium', 'large', 'original' ] ).map( ( s ) => [ s, s ] );
    const size = select( sizes, get( 'alt' ) || options.defaultSize || 'medium' );
    let align0 = get( 'align' );
    if ( align0 === 'middle' )
        align0 = 'center';
    const align = select( [ [ '', t( '-- Not set --' ) ], [ 'left', t( 'Left' ) ], [ 'center', t( 'Center' ) ], [ 'right', t( 'Right' ) ] ], align0 );
    const views = ( def.views && def.views.length ? def.views : ( options.viewModes || [ 'embed', 'embed-inline' ] ) ).map( ( v ) => [ v, v ] );
    const view = select( views, get( 'view' ) || ( inline ? 'embed-inline' : 'embed' ) );
    const cls = select( classOptions( t, def.classes ), cleanClass( get( 'class' ) ) );
    const inlineBox = h( 'input', { type: 'checkbox', checked: inline } );
    const custom = attributeFields( t, def.attributes, parseCustomAttributes( get( 'customattributes' ) ) );
    const titles = { images: 'Insert/edit image', files: 'Insert/edit file', objects: 'Insert/edit object' };

    open( ctx, {
        title: t( titles[contentType] || 'Insert/edit object' ), width: 620, busyText: t( 'Loading preview...' ),
        description: t( 'Search, browse or upload the content to embed, then choose how it is shown.' ),
        body: [ chosen, picker.element, uploadBox,
                h( 'fieldset', { class: 'exp-oe-embed-props' }, [ h( 'legend', { text: t( 'Properties' ) } ),
                    field( t( 'Size' ), size ), field( t( 'Alignment' ), align ), field( t( 'View' ), view ),
                    field( t( 'Class' ), cls ), field( t( 'Inline' ), inlineBox ) ].concat( custom.rows ) ) ],
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                if ( !embedId )
                    throw new Error( t( 'Please choose an object first' ) );
                const data = {
                    inline: inlineBox.checked, size: size.value, align: align.value, view: view.value,
                    cssClass: cls.value, customAttributes: serializeCustomAttributes( custom.read() )
                };
                if ( data.inline && view.value === 'embed' )
                    data.view = 'embed-inline';
                if ( !data.inline && view.value === 'embed-inline' )
                    data.view = 'embed';
                return buildEmbedHTML( ctx, api, embedId, data ).then( ( html ) => {
                    const range = existing ? { from: existing.pos, to: existing.pos + existing.node.nodeSize } : null;
                    insertDialectHTML( ctx, html, range );
                } );
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

// ---------------------------------------------------------------- custom tag

function selectedCustomTag( ctx ) {
    const found = selectedAncestor( ctx.editor, ( n ) => /custom/i.test( n.type.name ) );
    if ( found ) {
        found.el = dialect( ctx, found.node );
        return found;
    }
    // inline custom tags may be marks
    const marks = ctx.editor.state.selection.$from.marks().filter( ( m ) => /custom/i.test( m.type.name ) );
    if ( marks.length )
        return { mark: marks[0], el: dialect( ctx, marks[0] ) };
    return null;
}

function customTagName( el ) {
    if ( !el )
        return '';
    return cleanClass( el.getAttribute( 'class' ) ).split( ' ' )[0] || '';
}

/**
 * The custom tag definitions a list of tags offers: without those content.ini [CustomTagSettings] IsHidden[]
 * names (hidden: true), except `current`, the tag being edited.
 */
export function offeredCustomTags( tags, current ) {
    return ( tags || [] ).filter( ( d ) => !d.hidden || ( current && d.name === current ) );
}

function customTagDialog( ctx ) {
    const { editor, t, options } = ctx;
    const tags = options.customTags || [];
    const existing = selectedCustomTag( ctx );
    const currentName = existing ? customTagName( existing.el ) : '';
    const stored = existing && existing.el ? parseCustomAttributes( existing.el.getAttribute( 'customattributes' ) ) : {};
    // content.ini [CustomTagSettings] IsHidden[]: not offered, except the hidden tag being edited
    // (LoveStack commit e21ef46691, Copyright (C) Mugo Web, GPL v2)
    const offered = offeredCustomTags( tags, currentName );
    const nameSelect = select( offered.map( ( d ) => [ d.name, d.title || d.name ] ), currentName || ( offered[0] && offered[0].name ) );
    nameSelect.disabled = !!existing;
    const attrBox = h( 'div', { class: 'exp-oe-custom-attributes' } );
    let custom = null;
    const renderAttributes = () => {
        clear( attrBox );
        const def = tags.find( ( d ) => d.name === nameSelect.value ) || { attributes: [] };
        custom = attributeFields( t, def.attributes, nameSelect.value === currentName ? stored : {} );
        custom.rows.forEach( ( r ) => attrBox.appendChild( r ) );
        // the example image, images/editor/custom_tags_thumbs/<name>.png (LoveStack commit 63334f1681)
        if ( def.preview )
            attrBox.appendChild( h( 'div', { class: 'exp-oe-custom-tag-preview' }, [
                h( 'p', {}, [ h( 'strong', { text: t( 'Example' ) } ) ] ), h( 'img', { src: def.preview, alt: '' } ) ] ) );
    };
    nameSelect.addEventListener( 'change', renderAttributes );
    renderAttributes();

    const styleMap = options.customAttributeStyleMap || {};
    open( ctx, {
        title: t( 'Custom tag' ), width: 480,
        description: t( 'The tag and its attributes.' ),
        body: [ field( t( 'Name' ), nameSelect ), attrBox ],
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const def = tags.find( ( d ) => d.name === nameSelect.value );
                if ( !def )
                    return true;
                const values = custom.read();
                let style = '';
                for ( const [ k, v ] of Object.entries( values ) ) {
                    if ( v !== '' && styleMap[k] )
                        style += styleMap[k] + ': ' + v + ( /^\d+$/.test( v ) && /width|height|margin|padding|border-width|size/.test( styleMap[k] ) ? 'px' : '' ) + '; ';
                }
                const attrs = { 'class': 'ezoeItemCustomTag ' + def.name, type: 'custom', customattributes: serializeCustomAttributes( values ), style: style.trim() };
                if ( existing ) {
                    const tag = existing.el ? existing.el.tagName.toLowerCase() : 'span';
                    const elNew = makeElement( tag, attrs );
                    const type = existing.mark ? existing.mark.type : existing.node.type;
                    const newAttrs = attrsFromElement( type, elNew );
                    if ( !newAttrs )
                        return true;
                    if ( existing.mark )
                        return editor.chain().focus().extendMarkRange( type.name ).setMark( type.name, newAttrs ).run();
                    return editor.chain().focus().command( ( { tr } ) => {
                        tr.setNodeMarkup( existing.pos, undefined, Object.assign( {}, existing.node.attrs, newAttrs ) );
                        return true;
                    } ).run();
                }
                let html;
                if ( def.inline === 'image' ) {
                    html = makeElement( 'img', Object.assign( { src: def.icon, width: 22, height: 22 }, attrs ) ).outerHTML;
                } else if ( def.inline ) {
                    const text = selectedText( editor ) || ' ';
                    html = makeElement( def.name === 'underline' ? 'u' : 'span', attrs, escapeHtml( text ) ).outerHTML;
                } else {
                    const inner = selectedHTML( editor ) || '<p>' + escapeHtml( def.name ) + '</p>';
                    html = makeElement( 'div', attrs, inner ).outerHTML;
                }
                return insertDialectHTML( ctx, html );
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

// ---------------------------------------------------------------- table

function tableDialog( ctx ) {
    const { editor, t, options } = ctx;
    const defs = options.tableDefinitions || {};
    const tdef = defs.table || {};
    const defaults = tdef.defaults || {};
    const existing = selectedAncestor( editor, ( n ) => n.type.spec.tableRole === 'table' );
    const el = existing ? dialect( ctx, existing.node ) : null;
    const get = ( a, d ) => ( el ? el.getAttribute( a ) || '' : ( d || '' ) );
    const rows = h( 'input', { type: 'number', min: 1, max: 100, value: 2 } );
    const cols = h( 'input', { type: 'number', min: 1, max: 30, value: 2 } );
    const header = h( 'input', { type: 'checkbox', checked: false } );
    const width = h( 'input', { type: 'text', value: get( 'width', defaults.width || '100%' ) } );
    const border = h( 'input', { type: 'text', value: get( 'border', defaults.border !== undefined ? String( defaults.border ) : '0' ) } );
    const cls = select( classOptions( t, tdef.classes ), cleanClass( get( 'class', defaults['class'] ) ) );
    const custom = attributeFields( t, tdef.attributes, parseCustomAttributes( get( 'customattributes' ) ) );
    const body = existing ? [] : [ field( t( 'Rows' ), rows ), field( t( 'Columns' ), cols ), field( t( 'Header row' ), header ) ];
    open( ctx, {
        title: existing ? t( 'Table properties' ) : t( 'Insert table' ), width: 420,
        description: existing ? t( 'The attributes of the table.' ) : t( 'Size and attributes of the new table.' ),
        body: body.concat( [ field( t( 'Width' ), width, t( 'Percentage with %, or a number for pixels' ) ), field( t( 'Border' ), border ), field( t( 'Class' ), cls ) ], custom.rows ),
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const attrs = { width: width.value.trim(), border: border.value.trim(), 'class': cls.value, customattributes: serializeCustomAttributes( custom.read() ) };
                if ( existing ) {
                    const newAttrs = attrsFromElement( existing.node.type, makeElement( 'table', attrs ) );
                    return editor.chain().focus().command( ( { tr } ) => {
                        tr.setNodeMarkup( existing.pos, undefined, Object.assign( {}, existing.node.attrs, newAttrs || {} ) );
                        return true;
                    } ).run();
                }
                const r = Math.max( 1, Math.min( 100, parseInt( rows.value, 10 ) || 1 ) ), c = Math.max( 1, Math.min( 30, parseInt( cols.value, 10 ) || 1 ) );
                let inner = '';
                for ( let i = 0; i < r; i++ ) {
                    const cell = header.checked && i === 0 ? 'th' : 'td';
                    inner += '<tr>' + ( '<' + cell + '><p><br></p></' + cell + '>' ).repeat( c ) + '</tr>';
                }
                return insertDialectHTML( ctx, makeElement( 'table', attrs, '<tbody>' + inner + '</tbody>' ).outerHTML );
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

/**
 * The cells a change of the cell dialog applies to, like "Apply to" of ezoe's tag_table_cell.tpl (cell, row, column)
 * plus the whole table and the selected cells (a cell selection): [ { pos, node } ], in document order.
 * Rows and columns follow the table's grid (TableMap): a merged cell belongs to every row and column it covers.
 */
export function cellsToApply( state, cellPos, mode ) {
    const doc = state.doc;
    if ( mode === 'selection' && state.selection instanceof CellSelection ) {
        const cells = [];
        state.selection.forEachCell( ( node, pos ) => cells.push( { pos, node } ) );
        return cells.sort( ( a, b ) => a.pos - b.pos );
    }
    const $cell = doc.resolve( cellPos );
    const table = $cell.node( -1 ), tableStart = $cell.start( -1 );
    if ( mode === 'cell' || !table || table.type.spec.tableRole !== 'table' )
        return [ { pos: cellPos, node: doc.nodeAt( cellPos ) } ];
    const map = TableMap.get( table );
    const rect = map.findCell( cellPos - tableStart );
    const area = mode === 'row' ? { left: 0, right: map.width, top: rect.top, bottom: rect.top + 1 }
        : mode === 'column' ? { left: rect.left, right: rect.left + 1, top: 0, bottom: map.height }
        : { left: 0, right: map.width, top: 0, bottom: map.height };
    // every cell that covers a slot of the area, also a merged cell that starts outside it
    const seen = new Set();
    for ( let r = area.top; r < area.bottom; r++ ) {
        for ( let c = area.left; c < area.right; c++ )
            seen.add( map.map[r * map.width + c] );
    }
    return [ ...seen ].map( ( p ) => ( { pos: tableStart + p, node: doc.nodeAt( tableStart + p ) } ) ).sort( ( a, b ) => a.pos - b.pos );
}

function cellPropertiesDialog( ctx ) {
    const { editor, t, options } = ctx;
    const existing = selectedAncestor( editor, ( n ) => n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell' ) ||
                     ( editor.state.selection instanceof CellSelection ? { node: editor.state.selection.$anchorCell.nodeAfter, pos: editor.state.selection.$anchorCell.pos } : null );
    if ( !existing )
        return;
    const el = dialect( ctx, existing.node );
    const tag = el ? el.tagName.toLowerCase() : 'td';
    const def = ( options.tableDefinitions || {} )[tag] || {};
    const get = ( a ) => ( el ? el.getAttribute( a ) || '' : '' );
    const width = h( 'input', { type: 'text', value: get( 'width' ) } );
    // td or th, like the cell type of ezoe's cell dialog (tag_table_cell.tpl)
    const headerType = nodeForTag( editor, 'th' ), cellType = nodeForTag( editor, 'td' );
    const kind = headerType && cellType ? select( [ [ 'td', t( 'Data cell' ) ], [ 'th', t( 'Header cell' ) ] ], tag ) : null;
    const align = select( [ [ '', t( '-- Not set --' ) ], [ 'left', t( 'Left' ) ], [ 'center', t( 'Center' ) ], [ 'right', t( 'Right' ) ], [ 'justify', t( 'Justify' ) ] ], get( 'align' ) );
    const cls = select( classOptions( t, def.classes ), cleanClass( get( 'class' ) ) );
    const custom = attributeFields( t, def.attributes, parseCustomAttributes( get( 'customattributes' ) ) );
    // "Apply to", as in ezoe's cell dialog, plus the whole table and a selection of several cells
    const several = editor.state.selection instanceof CellSelection;
    const scopes = ( several ? [ [ 'selection', t( 'Selected cells' ) ] ] : [] ).concat(
        [ [ 'cell', t( 'Cell' ) ], [ 'row', t( 'Row' ) ], [ 'column', t( 'Column' ) ], [ 'table', t( 'All cells of the table' ) ] ] );
    const scope = select( scopes, several ? 'selection' : 'cell' );
    open( ctx, {
        title: t( 'Table cell properties' ), width: 420,
        description: t( 'The attributes of the selected cell.' ),
        body: ( kind ? [ field( t( 'Cell type' ), kind ) ] : [] ).concat(
            [ field( t( 'Width' ), width, t( 'Percentage with %, or a number for pixels' ) ), field( t( 'Alignment' ), align ), field( t( 'Class' ), cls ) ], custom.rows,
            [ field( t( 'Apply to' ), scope, t( 'The same type, width, alignment, class and custom attributes for every cell of the choice.' ) ) ] ),
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const newTag = kind ? kind.value : tag;
                const values = {
                    width: width.value.trim(), align: align.value, 'class': cls.value, customattributes: serializeCustomAttributes( custom.read() )
                };
                const cells = cellsToApply( editor.state, existing.pos, scope.value );
                return editor.chain().focus().command( ( { tr } ) => {
                    for ( const cell of cells ) {
                        const before = dialect( ctx, cell.node );
                        const own = ( a ) => ( before ? before.getAttribute( a ) || '' : '' );
                        // the cell type changes only where it was changed in the dialog; each cell keeps its own span
                        const ownTag = before ? before.tagName.toLowerCase() : tag;
                        const cellTag = newTag === tag ? ownTag : newTag;
                        const type = cellTag === ownTag ? cell.node.type : ( cellTag === 'th' ? headerType : cellType ).type;
                        const changed = makeElement( cellTag, Object.assign( {}, values, { colspan: own( 'colspan' ), rowspan: own( 'rowspan' ) } ) );
                        const attrs = withRemoved( type, before ? attrsFromElement( cell.node.type, before ) : {}, attrsFromElement( type, changed ) || {} );
                        tr.setNodeMarkup( tr.mapping.map( cell.pos ), type, Object.assign( {}, cell.node.attrs, attrs ) );
                    }
                    return true;
                } ).run();
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

/**
 * The class and custom attributes of a table row (content.ini [tr]), like ezoe's row dialog. target: a status bar
 * path item ({ node, pos } of the row).
 */
function rowPropertiesDialog( ctx, target ) {
    const { t, options } = ctx;
    const row = target && target.node && target.node.type.spec.tableRole === 'row' ? target
        : selectedAncestor( ctx.editor, ( n ) => n.type.spec.tableRole === 'row' );
    if ( !row )
        return;
    const def = ( options.tableDefinitions || {} ).tr || {};
    const el = dialect( ctx, row.node );
    const value = cleanClass( el && el.getAttribute( 'class' ) );
    const cls = select( classOptionsWith( t, def.classes, value ), value );
    cls.value = value;
    const custom = attributeFields( t, def.attributes, parseCustomAttributes( el && el.getAttribute( 'customattributes' ) ) );
    open( ctx, {
        title: t( 'Table row properties' ), width: 420,
        description: t( 'The attributes of the table row.' ),
        body: [ field( t( 'Class' ), cls ) ].concat( custom.rows ),
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const values = custom.read();
                return !el || applyAttrs( ctx, { node: row.node, pos: row.pos }, elementAttrs( ctx, row.node.type, el, cls.value, values ) );
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

// ---------------------------------------------------------------- literal

/**
 * Literal text with its class and custom attributes (content.ini [literal] AvailableClasses, CustomAttributes), like
 * ezoe's literal dialog. Without classes and attributes the literal button only switches between paragraph and
 * literal (commands.js, literalHasProperties()).
 */
function literalDialog( ctx ) {
    const { editor, t, options } = ctx;
    const pre = nodeForTag( editor, 'pre' );
    if ( !pre )
        return;
    const def = options.literal || {};
    const existing = selectedAncestor( editor, ( n ) => n.type === pre.type );
    const el = existing ? dialect( ctx, existing.node ) : null;
    const get = ( a ) => ( el ? el.getAttribute( a ) || '' : '' );
    const cls = select( classOptions( t, def.classes ), cleanClass( get( 'class' ) ) );
    const custom = attributeFields( t, def.attributes, parseCustomAttributes( get( 'customattributes' ) ) );
    const apply = ( pos, node ) => {
        const newAttrs = attrsFromElement( pre.type, makeElement( 'pre', { 'class': cls.value, customattributes: serializeCustomAttributes( custom.read() ) } ) ) || {};
        return editor.chain().focus().command( ( { tr } ) => {
            tr.setNodeMarkup( pos, undefined, Object.assign( {}, node.attrs, newAttrs ) );
            return true;
        } ).run();
    };
    const buttons = [ { text: t( 'OK' ), primary: true, onClick: () => {
        if ( existing )
            return apply( existing.pos, existing.node );
        custom.read();
        if ( !setBlockFormat( editor, 'pre' ) )
            return true;
        const now = selectedAncestor( editor, ( n ) => n.type === pre.type );
        return now ? apply( now.pos, now.node ) : true;
    } }, { text: t( 'Cancel' ), cancel: true } ];
    if ( existing )
        buttons.splice( 1, 0, { text: t( 'Convert to paragraph' ), onClick: () => {
            // a plain paragraph: the class and the custom attributes of the literal do not carry over
            const para = nodeForTag( editor, 'p' );
            return !para || editor.chain().focus().setNode( para.name, Object.assign( {}, para.attrs, { 'class': null, customattributes: null } ) ).run();
        } } );
    open( ctx, {
        title: t( 'Literal text' ), width: 420,
        description: existing ? t( 'The attributes of the literal text.' ) : t( 'Turns the paragraph into literal text, shown as it is typed.' ),
        body: [ field( t( 'Class' ), cls ) ].concat( custom.rows ),
        buttons
    } );
}

// ---------------------------------------------------------------- general attributes (class and custom attributes)

/**
 * The style attribute after a change of the custom attributes: the styles of ezoe.ini [EditorSettings]
 * CustomAttributeStyleMap are made from the values exactly as eZOEXMLInput::getCustomAttrPart() writes them (only
 * margin, border, padding, width and height; the value as it is), every other style of the element stays.
 */
export function styleWithCustomAttributes( style, values, styleMap ) {
    const map = {};
    for ( const [ name, property ] of Object.entries( styleMap || {} ) ) {
        if ( /(margin|border|padding|width|height)/.test( property ) )
            map[name] = String( property ).toLowerCase();
    }
    const mapped = Object.values( map );
    const kept = String( style || '' ).split( ';' ).map( ( s ) => s.trim() )
        .filter( ( s ) => s && mapped.indexOf( s.split( ':' )[0].trim().toLowerCase() ) === -1 );
    let out = kept.length ? kept.join( '; ' ) + '; ' : '';
    for ( const [ name, value ] of Object.entries( values || {} ) ) {
        if ( value !== '' && map[name] )
            out += map[name] + ': ' + value + '; ';
    }
    return out.trim();
}

/** Class options of a definition, plus the current class where content.ini does not list it (it stays selectable) */
function classOptionsWith( t, classes, current ) {
    const list = classOptions( t, classes );
    if ( current && !list.some( ( [ v ] ) => v === current ) )
        list.push( [ current, current ] );
    return list;
}

/**
 * Class, custom attributes and their styles of a node or mark: the element of the ezoe dialect is changed and read
 * back through the schema's parse rules, so the dialog does not depend on the schema's attribute names. ezoe's
 * internal classes (ezoeItem..., mceItem...) of the element stay.
 */
function elementAttrs( ctx, type, el, cssClass, values ) {
    const before = attrsFromElement( type, el ) || {};
    const internal = String( el.getAttribute( 'class' ) || '' ).split( /\s+/ ).filter( ( c ) => c && cleanClass( c ) === '' );
    const set = ( name, value ) => ( value ? el.setAttribute( name, value ) : el.removeAttribute( name ) );
    set( 'class', internal.concat( cssClass ? [ cssClass ] : [] ).join( ' ' ) );
    set( 'customattributes', serializeCustomAttributes( values ) );
    set( 'style', styleWithCustomAttributes( el.getAttribute( 'style' ), values, ctx.options.customAttributeStyleMap ) );
    return withRemoved( type, before, attrsFromElement( type, el ) );
}

/**
 * The attributes read from a changed element, plus the default of every attribute the element had before and has no
 * more: the parse rules leave out an attribute that is not in the HTML, so merged over the old attributes a removed
 * class or custom attribute would come back.
 */
export function withRemoved( type, before, after ) {
    if ( !after )
        return after;
    const result = Object.assign( {}, after );
    for ( const key of Object.keys( before || {} ) ) {
        if ( !( key in result ) )
            result[key] = type.attrs && type.attrs[key] ? type.attrs[key].default : null;
    }
    return result;
}

/** Writes new attributes onto a node (setNodeMarkup) or over the range of a mark */
function applyAttrs( ctx, item, attrs ) {
    if ( !attrs )
        return true;
    return ctx.editor.chain().focus().command( ( { tr } ) => {
        if ( item.mark ) {
            tr.removeMark( item.range.from, item.range.to, item.mark );
            tr.addMark( item.range.from, item.range.to, item.mark.type.create( Object.assign( {}, item.mark.attrs, attrs ) ) );
        }
        else
            tr.setNodeMarkup( item.pos, undefined, Object.assign( {}, item.node.attrs, attrs ) );
        return true;
    } ).run();
}

/**
 * The class and custom attributes of a paragraph, heading, list, list item, strong or emphasize, like ezoe's
 * tag_general.tpl and tag_header.tpl: content.ini [<tag>] AvailableClasses[] (ClassDescription[]) and
 * CustomAttributes[] with the types and names of ezoe_attributes.ini (options.generalDefinitions). Where the cursor
 * is inside several of them (bold text in a list item ...), the dialog lists them, innermost first; target, a status
 * bar path item, chooses one.
 */
function generalDialog( ctx, target ) {
    const { t, options } = ctx;
    const targets = generalTargets( ctx.editor );
    if ( !targets.length )
        return;
    const defs = options.generalDefinitions || {};
    let current = preferredTarget( targets, target );
    const box = h( 'div', { class: 'exp-oe-general-attributes' } );
    let state = null;
    const render = () => {
        clear( box );
        const item = targets[current];
        const def = defs[item.xml] || {};
        const el = dialect( ctx, item.mark || item.node );
        const value = cleanClass( el && el.getAttribute( 'class' ) );
        const cls = select( classOptionsWith( t, def.classes, value ), value );
        cls.value = value;
        const custom = attributeFields( t, def.attributes, parseCustomAttributes( el && el.getAttribute( 'customattributes' ) ) );
        box.appendChild( field( t( 'Class' ), cls ) );
        custom.rows.forEach( ( r ) => box.appendChild( r ) );
        if ( !Object.keys( def.classes || {} ).length && !( def.attributes || [] ).length )
            box.appendChild( h( 'p', { class: 'exp-oe-hint', text: t( 'This tag has no classes or custom attributes in content.ini.' ) } ) );
        state = { item, el, cls, custom };
    };
    const body = [];
    if ( targets.length > 1 ) {
        const which = select( targets.map( ( c, i ) => [ String( i ), t( TAG_LABELS[c.xml] || c.xml ) + ' <' + c.xml + '>' ] ), String( current ) );
        which.value = String( current );
        which.addEventListener( 'change', () => {
            current = parseInt( which.value, 10 );
            render();
        } );
        body.push( field( t( 'Element' ), which, t( 'The element at the cursor whose attributes are edited.' ) ) );
    }
    render();
    body.push( box );
    open( ctx, {
        title: t( 'Tag properties' ), width: 420,
        description: t( 'The class and the custom attributes of the element.' ),
        body,
        buttons: [
            { text: t( 'OK' ), primary: true, onClick: () => {
                const { item, el, cls, custom } = state;
                const values = custom.read();
                return !el || applyAttrs( ctx, item, elementAttrs( ctx, ( item.mark || item.node ).type, el, cls.value, values ) );
            } },
            { text: t( 'Cancel' ), cancel: true }
        ]
    } );
}

// ---------------------------------------------------------------- special characters and help

const CHARS = '  & © ® ™ ° ± × ÷ µ ¶ § … – — ‘ ’ ‚ “ ” „ ‹ › « » • · † ‡ ‰ ′ ″ € £ ¥ ¢ ¤ ¼ ½ ¾ ¹ ² ³ ª º ¿ ¡ ← ↑ → ↓ ↔ ⇒ ⇔ ∀ ∂ ∃ ∅ ∇ ∈ ∉ ∏ ∑ − √ ∝ ∞ ∧ ∨ ∩ ∪ ∫ ≈ ≠ ≡ ≤ ≥ α β γ δ ε λ μ π σ ω Δ Σ Ω Ä Ö Ü ä ö ü ß À Á Â Ç È É Ê à á â ç è é ê ñ Ñ ø Ø å Å æ Æ œ Œ'.split( ' ' );

function charmapDialog( ctx ) {
    const { editor, t } = ctx;
    let dialog = null;
    const grid = h( 'div', { class: 'exp-oe-charmap', role: 'group', 'aria-label': t( 'Special characters' ) }, CHARS.map( ( c ) => h( 'button', {
        type: 'button', class: 'exp-oe-char', title: c === ' ' ? t( 'Non-breaking space' ) : 'U+' + c.charCodeAt( 0 ).toString( 16 ).toUpperCase().padStart( 4, '0' ),
        'aria-label': c === ' ' ? t( 'Non-breaking space' ) : null,
        text: c === ' ' ? '␣' : c,
        onclick: () => {
            editor.chain().focus().insertContent( c === '&' ? '&amp;' : c ).run();
            if ( dialog )
                dialog.close();
        }
    } ) ) );
    dialog = open( ctx, {
        title: t( 'Insert special character' ), width: 460, description: t( 'Choose a character to insert it at the cursor.' ),
        body: [ grid ], buttons: [ { text: t( 'Close' ), cancel: true } ]
    } );
}

// ---------------------------------------------------------------- source

const BLOCK_TAGS = /^(p|h[1-6]|ul|ol|li|table|tbody|thead|tfoot|tr|td|th|pre|div)$/;

/**
 * The posted HTML with one block per line, indented by nesting, for reading. Only white space between tags changes
 * (none of it is content in ezoe's dialect); the content of a block (and of a literal) stays on its line as posted.
 */
export function formatSource( html ) {
    const out = [];
    let depth = 0, line = '', openOnLine = -1;
    const flush = () => {
        if ( line.trim() )
            out.push( line );
        line = '';
        openOnLine = -1;
    };
    const indent = () => '  '.repeat( Math.max( 0, depth ) );
    const re = /<(\/?)([a-zA-Z][\w:-]*)\b[^>]*>|[^<]+|</g;
    let m, pre = 0;
    while ( ( m = re.exec( String( html || '' ) ) ) ) {
        const token = m[0], tag = ( m[2] || '' ).toLowerCase();
        const block = !!tag && BLOCK_TAGS.test( tag ) && !( pre && tag !== 'pre' );
        if ( !block ) {
            line = ( line || indent() ) + token;
            continue;
        }
        if ( m[1] !== '/' ) {
            flush();
            line = indent() + token;
            openOnLine = depth;
            depth++;
            if ( tag === 'pre' )
                pre++;
            continue;
        }
        depth--;
        if ( tag === 'pre' )
            pre--;
        if ( openOnLine === depth )
            line += token;          // <p>text</p> on one line
        else {
            flush();
            line = indent() + token;
        }
        flush();
    }
    flush();
    return out.join( '\n' );
}

/** Indents (or with outdent, outdents) the lines of a textarea's selection by two spaces; no selection: inserts two */
export function indentSource( area, outdent ) {
    const value = area.value, start = area.selectionStart, end = area.selectionEnd;
    if ( !outdent && start === end ) {
        area.setRangeText( '  ', start, end, 'end' );
        return;
    }
    const from = value.lastIndexOf( '\n', start - 1 ) + 1;
    const to = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const lines = value.slice( from, to ).split( '\n' );
    const changed = lines.map( ( l ) => ( outdent ? l.replace( /^ {1,2}/, '' ) : '  ' + l ) );
    const first = changed[0].length - lines[0].length;
    area.setRangeText( changed.join( '\n' ), from, to, 'preserve' );
    const delta = changed.join( '\n' ).length - lines.join( '\n' ).length;
    area.setSelectionRange( Math.max( from, start + first ), Math.max( from, end + delta ) );
}

/** The text of one change sourceChanges() found */
function sourceChangeText( t, change ) {
    if ( change.type === 'paragraph' )
        return t( '%1 becomes a paragraph' ).replace( '%1', change.tag );
    if ( change.type === 'attribute' )
        return t( 'Attribute %1 of %2 is removed or changed' ).replace( '%1', change.attribute ).replace( '%2', change.tag );
    if ( change.type === 'text' )
        return t( 'Text is removed: %1' ).replace( '%1', '\u201e' + change.text + '\u201c' );
    return t( '%1 is removed' ).replace( '%1', change.tag );
}

/**
 * The source of the text: the HTML of ezoe's dialect that the form posts (eZOEInputParser turns it into the stored
 * ezxmltext), one block per line, with a copy button. Editable unless exp_oe_tiptap.ini [EditorSettings]
 * SourceEditable=disabled: Apply cleans the HTML as pasted HTML (source.js), lists what the schema would drop and
 * asks before it does, then puts the document into the editor as one step of Undo.
 */
function sourceDialog( ctx ) {
    const { t } = ctx;
    const html = ctx.instance.getHTML();
    const editable = ctx.options.sourceEditable !== false && !ctx.schema.isFallback && ctx.instance.isEditable();
    const area = h( 'textarea', {
        class: 'exp-oe-source-view', readonly: !editable, rows: 18, spellcheck: 'false', wrap: 'off',
        autocapitalize: 'off', autocomplete: 'off', 'data-exp-oe-tab': editable ? 'insert' : null
    } );
    area.value = formatSource( html );
    const status = h( 'div', { class: 'exp-oe-hint exp-oe-source-status', role: 'status', 'aria-live': 'polite' } );
    const copy = () => {
        const done = () => { status.textContent = t( 'Copied to the clipboard.' ); };
        if ( navigator.clipboard && navigator.clipboard.writeText )
            return navigator.clipboard.writeText( area.value ).then( done, () => { area.select(); status.textContent = t( 'Select the text and copy it with Ctrl+C.' ); } ).then( () => false );
        area.select();
        status.textContent = t( 'Select the text and copy it with Ctrl+C.' );
        return false;
    };
    const note = h( 'p', { class: 'exp-oe-source-note', text: t( 'HTML of the editor; what is stored is ezxmltext, which the server makes of it when the form is stored.' ) } );
    let dialog;
    if ( !editable ) {
        dialog = open( ctx, {
            title: t( 'Source' ), width: 720, className: 'exp-oe-source',
            description: t( 'The HTML the editor posts; the server stores it as ezxmltext. Read only: change the text in the editor.' ),
            body: [ note, field( t( 'HTML' ), area, t( '%n characters' ).replace( '%n', html.length ) ), status ],
            buttons: [ { text: t( 'Copy' ), onClick: copy }, { text: t( 'Close' ), primary: true } ]
        } );
    } else {
        const keysHint = () => ( area.getAttribute( 'data-exp-oe-tab' ) === 'insert'
            // Ctrl+M is the Control key on a Mac too (Cmd+M minimises the window): ⌃M there
            ? t( 'Tab indents, Shift+Tab outdents; Ctrl+M makes Tab move the focus. Escape cancels.', null, { control: true } )
            : t( 'Tab moves the focus; Ctrl+M makes it indent again. Escape cancels.', null, { control: true } ) ) + ' ' + t( '%n characters' ).replace( '%n', area.value.length );
        const wrap = h( 'input', { type: 'checkbox', class: 'exp-oe-source-wrap', onchange: () => {
            area.setAttribute( 'wrap', wrap.checked ? 'soft' : 'off' );
            area.classList.toggle( 'exp-oe-source-wrapped', wrap.checked );
        } } );
        const list = h( 'ul', { class: 'exp-oe-source-changes' } );
        const warning = h( 'div', { class: 'exp-oe-source-warning', role: 'alert', hidden: true }, [
            h( 'p', { text: t( 'The editor cannot keep all of it:' ) } ), list,
            h( 'p', { text: t( 'Apply anyway takes the text as listed; or change the source.' ) } )
        ] );
        let confirmed = false, discard = false;
        const initial = area.value;
        // unapplied changes: the first Cancel (or Escape, or ×) asks, the second one discards them
        const cancelSource = () => {
            if ( area.value === initial || discard )
                return true;
            discard = true;
            status.textContent = t( 'The changes are not applied. Cancel again (or Escape) to discard them.' );
            area.focus();
            return false;
        };
        const primaryButton = () => dialog && dialog.element.querySelector( '.exp-oe-dialog-footer .exp-oe-primary' );
        const reset = () => {
            if ( !confirmed && warning.hidden )
                return;
            confirmed = false;
            warning.hidden = true;
            if ( primaryButton() )
                primaryButton().textContent = t( 'Apply' );
        };
        const sourceField = field( t( 'HTML' ), area, keysHint() );
        const hintEl = sourceField.querySelector( '.exp-oe-hint' );
        area.addEventListener( 'input', () => {
            reset();
            discard = false;
            hintEl.textContent = keysHint();
        } );
        area.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'm' || e.key === 'M' ) {
                if ( !e.ctrlKey || e.altKey || e.metaKey || e.shiftKey )
                    return;
                e.preventDefault();
                area.setAttribute( 'data-exp-oe-tab', area.getAttribute( 'data-exp-oe-tab' ) === 'insert' ? 'move' : 'insert' );
                hintEl.textContent = keysHint();
                status.textContent = area.getAttribute( 'data-exp-oe-tab' ) === 'insert' ? t( 'Tab indents.' ) : t( 'Tab moves the focus.' );
            } else if ( e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && area.getAttribute( 'data-exp-oe-tab' ) === 'insert' ) {
                e.preventDefault();
                indentSource( area, e.shiftKey );
                area.dispatchEvent( new Event( 'input' ) );
            }
        } );
        const apply = () => {
            const read = readSource( area.value, ctx.instance );
            if ( read.changes.length && !confirmed && !read.same ) {
                clear( list );
                for ( const change of read.changes )
                    list.appendChild( h( 'li', { text: sourceChangeText( t, change ) } ) );
                warning.hidden = false;
                confirmed = true;
                primaryButton().textContent = t( 'Apply anyway' );
                if ( warning.scrollIntoView )
                    warning.scrollIntoView( { block: 'nearest' } );
                return false;
            }
            applySource( ctx.instance, read );
            return true;
        };
        dialog = open( ctx, {
            title: t( 'Source' ), width: 720, className: 'exp-oe-source exp-oe-source-editable',
            description: t( 'Apply puts the changed HTML into the editor; Undo takes it back.' ),
            body: [ note, sourceField, field( t( 'Wrap lines' ), wrap ), warning, status ],
            buttons: [ { text: t( 'Copy' ), onClick: copy }, { text: t( 'Cancel' ), cancel: true, onClick: cancelSource }, { text: t( 'Apply' ), primary: true, onClick: apply } ]
        } );
    }
    // the focus is in the field: from its start, not scrolled to its end
    if ( dialog && area.setSelectionRange ) {
        area.setSelectionRange( 0, 0 );
        area.scrollTop = 0;
    }
}

function helpDialog( ctx ) {
    const { t } = ctx;
    const dialog = open( ctx, {
        title: t( 'Help' ), width: 640, className: 'exp-oe-help',
        description: t( 'How to use the editor: the buttons, the keyboard, the tags, tips.' ),
        body: helpContent( ctx, ctx.instance && ctx.instance.toolbar ? ctx.instance.toolbar.buttons : [], ctx.instance ? ctx.instance.commands : {} ),
        buttons: [ { text: t( 'Close' ), primary: true } ]
    } );
    // o2k7: the icons are ezoe's sprite, whose URL the editor's wrapper carries
    const wrapper = ctx.instance && ctx.instance.wrapper;
    for ( const name of [ '--exp-oe-icons', '--exp-oe-button-bg' ] ) {
        const value = wrapper && wrapper.style.getPropertyValue( name );
        if ( value )
            dialog.element.style.setProperty( name, value );
    }
}

export function createDialogs() {
    return {
        link: linkDialog,
        anchor: anchorDialog,
        embed: embedDialog,
        customTag: customTagDialog,
        table: tableDialog,
        cellProperties: cellPropertiesDialog,
        rowProperties: rowPropertiesDialog,
        literal: literalDialog,
        general: generalDialog,
        source: sourceDialog,
        charmap: charmapDialog,
        help: helpDialog
    };
}

export { nodeForTag, markForTag, SHORTCUTS };
