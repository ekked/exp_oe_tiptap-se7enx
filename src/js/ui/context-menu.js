/**
 * The editor's context menu: a right click into the text, the context menu key or Shift+F10 opens a menu with the
 * commands for what is at the cursor (link, anchor, embed, custom tag, literal, table, row and cell, tag properties),
 * like TinyMCE's contextmenu plugin. The commands are the toolbar's (editor/commands.js), whether the toolbar shows
 * them or not.
 *
 * Keyboard, as the floating menus (WAI-ARIA menu): the first item has the focus, up/down, Home and End move, Enter or
 * Space runs an item, Escape closes the menu and returns to the text, Tab closes it. The browser's own context menu
 * stays at hand: a right click with Ctrl held, or a second right click while the menu is open.
 * Switched off with exp_oe_tiptap.ini [EditorSettings] ContextMenu=disabled (options.contextMenu false).
 *
 * @license GPL-2.0-or-later
 */
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { h, clear } from './dom.js';
import { moveFocus, setRoving } from './floating-menus.js';
import { linkMark, selectedAncestor } from '../editor/schema-utils.js';
import { literalHasProperties } from '../editor/commands.js';
import { generalTargets } from '../editor/tags.js';

/** The texts of the menu items */
export const LABELS = {
    editLink: 'Edit link',
    insertLink: 'Insert link',
    removeLink: 'Remove link',
    editAnchor: 'Edit anchor',
    editImage: 'Edit image',
    editObject: 'Edit embedded object',
    editFile: 'Edit file',
    editCustom: 'Edit custom tag',
    editLiteral: 'Literal text properties',
    tableProps: 'Table properties',
    rowProps: 'Table row properties',
    cellProps: 'Table cell properties',
    rowBefore: 'Insert row before',
    rowAfter: 'Insert row after',
    colBefore: 'Insert column before',
    colAfter: 'Insert column after',
    deleteRow: 'Delete row',
    deleteCol: 'Delete column',
    mergeCells: 'Merge table cells',
    splitCells: 'Split merged table cells',
    deleteTable: 'Delete table',
    tagProps: 'Tag properties'
};

/** [ label key, command name, icon ] by group; a group is shown when its test passes, an item when its command can run */
function groups( ctx ) {
    const { editor, options } = ctx;
    const sel = editor.state.selection;
    const link = linkMark( editor );
    const inLink = !!link && editor.isActive( link.name );
    const node = sel instanceof NodeSelection ? sel.node : null;
    const embed = node && ( /embed/i.test( node.type.name ) || /^eZ(Object|Node)_\d+$/.test( node.attrs.id || '' ) ) ? node : null;
    const embedKind = !embed ? '' : /image/i.test( embed.type.name ) || embed.type.name === 'image' ? 'image'
        : /ezoeItemContentTypeFiles/.test( embed.attrs.class || '' ) ? 'file' : 'object';
    const custom = selectedAncestor( editor, ( n ) => /custom/i.test( n.type.name ) ) ||
                   sel.$from.marks().some( ( m ) => /custom/i.test( m.type.name ) && !/underline/.test( m.attrs.class || '' ) );
    const literal = selectedAncestor( editor, ( n ) => n.type.spec.code );
    const inTable = !!ctx.instance.inTable();
    return [
        inLink ? [ [ 'editLink', 'link', 'link' ], [ 'removeLink', 'unlink', 'unlink' ] ]
            : !sel.empty && !node && link ? [ [ 'insertLink', 'link', 'link' ] ] : [],
        node && /anchor/i.test( node.type.name ) ? [ [ 'editAnchor', 'anchor', 'anchor' ] ] : [],
        embed ? [ embedKind === 'image' ? [ 'editImage', 'image', 'image' ] : embedKind === 'file' ? [ 'editFile', 'file', 'file' ] : [ 'editObject', 'object', 'object' ] ] : [],
        custom && ( options.customTags || [] ).length ? [ [ 'editCustom', 'custom', 'custom' ] ] : [],
        literal && literalHasProperties( options ) ? [ [ 'editLiteral', 'literal', 'literal' ] ] : [],
        inTable ? [ [ 'tableProps', 'table', 'table' ], [ 'rowProps', 'row_props', 'row_props' ], [ 'cellProps', 'cell_props', 'cell_props' ] ] : [],
        inTable ? [ [ 'rowBefore', 'row_before', 'row_before' ], [ 'rowAfter', 'row_after', 'row_after' ], [ 'colBefore', 'col_before', 'col_before' ],
                    [ 'colAfter', 'col_after', 'col_after' ], [ 'deleteRow', 'delete_row', 'delete_row' ], [ 'deleteCol', 'delete_col', 'delete_col' ] ] : [],
        inTable ? [ [ 'mergeCells', 'merge_cells', 'merge_cells' ], [ 'splitCells', 'split_cells', 'split_cells' ], [ 'deleteTable', 'delete_table', 'delete_table' ] ] : [],
        generalTargets( editor ).length ? [ [ 'tagProps', 'tag_props', 'tag_props' ] ] : []
    ];
}

export class ContextMenu {
    /**
     * @param {Object} ctx      { editor, t, instance, options }
     * @param {Object} commands the command registry
     */
    constructor( ctx, commands ) {
        this.ctx = ctx;
        this.commands = commands;
        this.items = [];
        this.element = h( 'div', { class: 'exp-oe-context-menu', role: 'menu', 'aria-label': ctx.t( 'Commands at the cursor' ), hidden: true } );
        this.element.addEventListener( 'keydown', ( e ) => {
            if ( moveFocus( this.items, e.key, true ) )
                e.preventDefault();
            else if ( e.key === 'Escape' ) {
                e.preventDefault();
                e.stopPropagation();
                this.close( true );
            }
            else if ( e.key === 'Tab' )
                this.close( false );
        } );
        this.nativeNext = false;
    }

    /** @param {Function} listen ( target, type, fn, capture ), a listener the instance removes on destroy */
    attach( listen ) {
        const dom = this.ctx.editor.view.dom;
        listen( dom, 'contextmenu', ( e ) => this.onContextMenu( e ) );
        listen( dom, 'keydown', ( e ) => {
            if ( ( e.key === 'F10' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey ) || e.key === 'ContextMenu' ) {
                e.preventDefault();
                this.openAtCursor();
            }
        } );
        listen( document, 'mousedown', ( e ) => {
            if ( this.isOpen() && !this.element.contains( e.target ) ) {
                // a second right click while the menu is open: the browser's menu
                this.nativeNext = e.button === 2;
                this.close( false );
            }
        }, true );
        listen( window, 'blur', () => this.close( false ) );
    }

    isOpen() {
        return !this.element.hidden;
    }

    onContextMenu( e ) {
        if ( e.ctrlKey || this.nativeNext || !this.ctx.instance.isEditable() ) {
            this.nativeNext = false;
            this.close( false );
            return;
        }
        // from the keyboard (no pointer position): at the cursor
        if ( !e.clientX && !e.clientY ) {
            e.preventDefault();
            this.openAtCursor();
            return;
        }
        this.selectAt( e.clientX, e.clientY );
        if ( this.open( e.clientX, e.clientY ) )
            e.preventDefault();
    }

    /** A right click outside the selection moves the cursor there first (onto an embed or anchor: selects it) */
    selectAt( x, y ) {
        const view = this.ctx.editor.view;
        const found = view.posAtCoords( { left: x, top: y } );
        if ( !found )
            return;
        const { from, to } = view.state.selection;
        if ( !view.state.selection.empty && found.pos >= from && found.pos <= to )
            return;
        let selection;
        const atom = found.inside >= 0 ? view.state.doc.nodeAt( found.inside ) : null;
        if ( atom && atom.isAtom && NodeSelection.isSelectable( atom ) )
            selection = NodeSelection.create( view.state.doc, found.inside );
        else
            selection = TextSelection.near( view.state.doc.resolve( found.pos ) );
        view.dispatch( view.state.tr.setSelection( selection ) );
    }

    openAtCursor() {
        const view = this.ctx.editor.view;
        let at;
        try {
            at = view.coordsAtPos( view.state.selection.from );
        } catch ( e ) {
            const r = view.dom.getBoundingClientRect();
            at = { left: r.left, bottom: r.top };
        }
        return this.open( at.left, at.bottom );
    }

    /** Builds the items for the selection and shows the menu at the viewport point x, y; false when nothing applies */
    open( x, y ) {
        const { t } = this.ctx;
        clear( this.element );
        this.items = [];
        for ( const group of groups( this.ctx ) ) {
            const buttons = [];
            for ( const [ key, name, icon ] of group ) {
                const def = this.commands[name];
                let ok = false;
                try {
                    ok = !!def && ( !def.available || def.available( this.ctx ) ) && ( !def.enabled || def.enabled( this.ctx ) );
                } catch ( e ) {
                    ok = false;
                }
                if ( !ok )
                    continue;
                const b = h( 'button', {
                    type: 'button', role: 'menuitem', class: 'exp-oe-menu-item', tabindex: '-1',
                    onmousedown: ( e ) => e.preventDefault(),
                    onclick: ( e ) => {
                        e.preventDefault();
                        this.close( false );
                        this.ctx.instance.runButton( name );
                    }
                }, [ h( 'span', { class: 'exp-oe-icon mce_' + icon, 'aria-hidden': 'true' } ), h( 'span', { class: 'exp-oe-menu-label', text: t( LABELS[key] ) } ) ] );
                buttons.push( b );
            }
            if ( !buttons.length )
                continue;
            if ( this.items.length )
                this.element.appendChild( h( 'div', { role: 'separator', class: 'exp-oe-menu-separator' } ) );
            buttons.forEach( ( b ) => this.element.appendChild( b ) );
            this.items = this.items.concat( buttons );
        }
        if ( !this.items.length ) {
            this.close( false );
            return false;
        }
        this.element.hidden = false;
        // in the viewport, beside the pointer or the cursor
        const w = this.element.offsetWidth || 220, hgt = this.element.offsetHeight || 0;
        const vw = window.innerWidth || document.documentElement.clientWidth, vh = window.innerHeight || document.documentElement.clientHeight;
        this.element.style.left = Math.max( 4, Math.min( x, vw - w - 4 ) ) + 'px';
        this.element.style.top = Math.max( 4, y + hgt > vh - 4 ? y - hgt : y ) + 'px';
        setRoving( this.items, null );
        moveFocus( this.items, 'Home', true );
        return true;
    }

    /** @param {boolean} focusText the focus goes back to the text (Escape) */
    close( focusText ) {
        if ( this.element.hidden )
            return;
        this.element.hidden = true;
        if ( focusText && !this.ctx.editor.isDestroyed )
            this.ctx.editor.view.focus();
    }
}
