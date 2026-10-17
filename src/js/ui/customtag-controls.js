/**
 * Custom tag controls (ezoe.ini [EditorSettings] CustomTagControls=enabled, options.customTagControls).
 *
 * When the selection is in a custom tag, a bar on the tag offers: move up, move down (block custom tags), edit
 * (the custom tag dialog) and remove (the tag goes, its content stays). The same from the keyboard:
 * Alt+Shift+Up, Alt+Shift+Down, Alt+Shift+E, Alt+Shift+Delete; Backspace in an empty block custom tag replaces
 * it with an empty paragraph. Every block custom tag shows its name (CustomTagsDescription) as a label.
 *
 * Everything works on the ProseMirror document through transactions: the bar is outside the editable content
 * and the labels are CSS, so nothing of either reaches the saved text.
 *
 * Portions derived from LoveStack (mugoweb/ezpublish-legacy, commit 63334f1681), Copyright (C) Mugo Web, GPL v2:
 * the design of the custom_tags_controls plugin (Copyright 2014, Mugo Web) -- controls on the focused custom tag
 * to move it up and down and to edit it, and Backspace removing an empty custom tag -- with thanks to Mugo Web.
 */
import { Extension, getMarkRange } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state';
import { h } from './dom.js';
import { shortcutLabel } from './keys.js';

const BLOCK = 'ezCustomBlock';
const IMAGE = 'ezCustomImage';
const INLINE = 'ezCustomInline';
const ATOM = 'ezCustomInlineAtom';
export const customTagControlsKey = new PluginKey( 'expOECustomTagControls' );

/**
 * The custom tag the selection is in: { kind: 'block'|'image'|'atom'|'inline', node, pos, depth, mark }, or null.
 * 'atom' is a selected atomic inline custom tag (a formula, nodes.js CustomInlineAtom).
 * @param {import('@tiptap/pm/state').EditorState} state
 */
export function findCustomTag( state ) {
    const sel = state.selection;
    if ( sel instanceof NodeSelection && sel.node.type.name === IMAGE )
        return { kind: 'image', node: sel.node, pos: sel.from };
    if ( sel instanceof NodeSelection && sel.node.type.name === ATOM )
        return { kind: 'atom', node: sel.node, pos: sel.from };
    if ( sel instanceof NodeSelection && sel.node.type.name === BLOCK )
        return { kind: 'block', node: sel.node, pos: sel.from, depth: sel.$from.depth + 1 };
    const $from = sel.$from;
    for ( let d = $from.depth; d > 0; d-- ) {
        const node = $from.node( d );
        if ( node.type.name === BLOCK )
            return { kind: 'block', node, pos: $from.before( d ), depth: d };
    }
    const mark = $from.marks().find( ( m ) => m.type.name === INLINE );
    if ( mark )
        return { kind: 'inline', mark, pos: $from.pos };
    return null;
}

function emptyParagraph( schema ) {
    return schema.nodes.paragraph.create();
}

/**
 * A transaction moving the block custom tag `found` before its previous or after its next sibling, or null.
 * The caret goes to the start of the moved tag; a tag that became the last one of the document gets an empty
 * paragraph after it, to go on writing there.
 */
export function moveCustomTag( state, found, forward ) {
    if ( !found || found.kind !== 'block' )
        return null;
    const $pos = state.doc.resolve( found.pos );
    const parent = $pos.parent, index = $pos.index();
    const other = forward ? ( index + 1 < parent.childCount ? parent.child( index + 1 ) : null ) : ( index > 0 ? parent.child( index - 1 ) : null );
    if ( !other )
        return null;
    const tr = state.tr;
    let start, newPos;
    if ( forward ) {
        start = found.pos;
        tr.replaceWith( start, start + found.node.nodeSize + other.nodeSize, [ other, found.node ] );
        newPos = start + other.nodeSize;
        if ( parent.type.name === 'doc' && index + 2 === parent.childCount )
            tr.insert( newPos + found.node.nodeSize, emptyParagraph( state.schema ) );
    } else {
        start = found.pos - other.nodeSize;
        tr.replaceWith( start, found.pos + found.node.nodeSize, [ found.node, other ] );
        newPos = start;
    }
    tr.setSelection( TextSelection.near( tr.doc.resolve( newPos + 1 ) ) );
    return tr.scrollIntoView();
}

/** A transaction removing the custom tag `found` and keeping its content (an image tag has none), or null */
export function removeCustomTag( state, found ) {
    if ( !found )
        return null;
    const tr = state.tr;
    if ( found.kind === 'block' )
        tr.replaceWith( found.pos, found.pos + found.node.nodeSize, found.node.content );
    else if ( found.kind === 'image' )
        tr.delete( found.pos, found.pos + found.node.nodeSize );
    else if ( found.kind === 'atom' ) {
        // its text stays, with the formatting the tag had
        const text = found.node.attrs.text || '';
        if ( text === '' )
            tr.delete( found.pos, found.pos + found.node.nodeSize );
        else
            tr.replaceWith( found.pos, found.pos + found.node.nodeSize, state.schema.text( text, found.node.marks ) );
    }
    else {
        // the whole run of the inline custom tag around the caret
        const range = getMarkRange( state.doc.resolve( found.pos ), found.mark.type, found.mark.attrs );
        if ( !range )
            return null;
        tr.removeMark( range.from, range.to, found.mark );
    }
    return tr.scrollIntoView();
}

/** Whether a block custom tag holds no text and no embed, image or table */
export function isEmptyCustomTag( node ) {
    if ( node.textContent.replace( /[\s ​]+/g, '' ) !== '' )
        return false;
    let other = false;
    node.descendants( ( n ) => {
        if ( !n.isText && n.type.name !== 'paragraph' && n.type.name !== 'hardBreak' )
            other = true;
        return !other;
    } );
    return !other;
}

/** A transaction replacing an empty block custom tag with an empty paragraph, or null */
export function removeEmptyCustomTag( state, found ) {
    if ( !found || found.kind !== 'block' || !isEmptyCustomTag( found.node ) )
        return null;
    const tr = state.tr.replaceWith( found.pos, found.pos + found.node.nodeSize, emptyParagraph( state.schema ) );
    tr.setSelection( TextSelection.near( tr.doc.resolve( found.pos + 1 ) ) );
    return tr.scrollIntoView();
}

/** CSS rules giving each block custom tag its label (the text of "::before") */
export function labelRules( tags, scope ) {
    return ( tags || [] ).filter( ( d ) => !d.inline && /^[A-Za-z0-9_-]+$/.test( d.name ) )
        .map( ( d ) => scope + ' div.ezoeItemCustomTag.' + d.name + '::before { content: "' + String( d.title || d.name ).replace( /["\\\n\r]/g, ' ' ) + '"; }' )
        .join( '\n' );
}

/**
 * The Tiptap extension of the controls for one editor instance (ExpOETiptapInstance).
 */
export function customTagControls( instance ) {
    const run = ( editor, make ) => {
        const tr = make( editor.state, findCustomTag( editor.state ) );
        if ( !tr )
            return false;
        editor.view.dispatch( tr );
        editor.view.focus();
        return true;
    };
    const edit = ( editor ) => {
        if ( !findCustomTag( editor.state ) )
            return false;
        instance.ctx.dialogs.customTag( instance.ctx );
        return true;
    };
    return Extension.create( {
        name: 'expOECustomTagControls',
        addKeyboardShortcuts() {
            return {
                'Alt-Shift-ArrowUp': () => run( this.editor, ( s, f ) => moveCustomTag( s, f, false ) ),
                'Alt-Shift-ArrowDown': () => run( this.editor, ( s, f ) => moveCustomTag( s, f, true ) ),
                'Alt-Shift-e': () => edit( this.editor ),
                'Alt-Shift-E': () => edit( this.editor ),
                'Alt-Shift-Delete': () => run( this.editor, removeCustomTag ),
                'Alt-Shift-Backspace': () => run( this.editor, removeCustomTag ),
                'Backspace': () => run( this.editor, removeEmptyCustomTag )
            };
        },
        addProseMirrorPlugins() {
            const editor = this.editor;
            return [ new Plugin( {
                key: customTagControlsKey,
                view: () => new CustomTagBar( instance, editor, { run, edit } )
            } ) ];
        }
    } );
}

/** The bar on the custom tag the selection is in, inside the scrolling content area */
class CustomTagBar {
    constructor( instance, editor, actions ) {
        const t = instance.t;
        this.instance = instance;
        this.editor = editor;
        const button = ( cls, symbol, label, keys, fn ) => h( 'button', {
            type: 'button', class: 'exp-oe-custom-tag-' + cls, 'aria-label': label, title: label + ' (' + shortcutLabel( keys, t ) + ')',
            onmousedown: ( e ) => e.preventDefault(),
            onclick: ( e ) => {
                e.preventDefault();
                fn();
            }
        }, symbol );
        this.up = button( 'up', '▲', t( 'Move the custom tag up' ), 'Alt+Shift+Up', () => actions.run( editor, ( s, f ) => moveCustomTag( s, f, false ) ) );
        this.down = button( 'down', '▼', t( 'Move the custom tag down' ), 'Alt+Shift+Down', () => actions.run( editor, ( s, f ) => moveCustomTag( s, f, true ) ) );
        this.editButton = button( 'edit', '✎', t( 'Edit the custom tag' ), 'Alt+Shift+E', () => actions.edit( editor ) );
        this.remove = button( 'remove', '✕', t( 'Remove the custom tag' ), 'Alt+Shift+Delete', () => actions.run( editor, removeCustomTag ) );
        this.element = h( 'div', {
            class: 'exp-oe-custom-tag-controls', role: 'toolbar', 'aria-label': t( 'Custom tag controls' ), hidden: true,
            onkeydown: ( e ) => {
                if ( e.key === 'Escape' ) {
                    e.preventDefault();
                    editor.view.focus();
                }
            }
        }, [ this.up, this.down, this.editButton, this.remove ] );
        this.element.hidden = true;
        instance.contentArea.appendChild( this.element );
        // labels for the block custom tags
        instance.wrapper.classList.add( 'exp-oe-custom-tag-labels' );
        const rules = labelRules( instance.options.customTags, '.exp-oe-custom-tag-labels' );
        if ( rules && !document.getElementById( 'exp-oe-custom-tag-labels' ) )
            document.head.appendChild( h( 'style', { id: 'exp-oe-custom-tag-labels', text: rules } ) );
        this.onScroll = () => this.update( editor.view );
        instance.contentArea.addEventListener( 'scroll', this.onScroll );
        this.update( editor.view );
    }

    update( view ) {
        const found = findCustomTag( view.state );
        if ( !found || !view.editable ) {
            this.element.hidden = true;
            return;
        }
        let dom = null;
        if ( found.kind === 'inline' ) {
            const at = view.domAtPos( found.pos );
            dom = at.node.nodeType === 1 ? at.node : at.node.parentElement;
            dom = dom && dom.closest( 'span.ezoeItemCustomTag, u' );
        } else
            dom = view.nodeDOM( found.pos );
        if ( !dom || !dom.getBoundingClientRect ) {
            this.element.hidden = true;
            return;
        }
        const block = found.kind === 'block';
        const $pos = view.state.doc.resolve( found.pos );
        this.up.hidden = this.down.hidden = !block;
        this.up.disabled = !( block && $pos.index() > 0 );
        this.down.disabled = !( block && $pos.index() + 1 < $pos.parent.childCount );
        this.element.hidden = false;
        const area = this.instance.contentArea, a = area.getBoundingClientRect(), r = dom.getBoundingClientRect();
        const top = r.top - a.top + area.scrollTop + 2;
        const left = Math.max( 2, r.right - a.left + area.scrollLeft - this.element.offsetWidth - 2 );
        this.element.style.top = Math.round( top ) + 'px';
        this.element.style.left = Math.round( left ) + 'px';
    }

    destroy() {
        this.instance.contentArea.removeEventListener( 'scroll', this.onScroll );
        this.element.remove();
    }
}
