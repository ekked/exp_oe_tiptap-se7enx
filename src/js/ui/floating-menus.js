/**
 * The floating menus of the a4 skin, in the manner of Tiptap's own editors:
 *  - a bubble menu over selected text (bold, italic, underline, link, unlink),
 *  - a "+" beside an empty paragraph that opens the insert commands (image, object, file, table, custom tag,
 *    literal).
 * Both run the toolbar's own commands (editor/commands.js), so what they do, their names and their states are the
 * toolbar's; the toolbar stays the complete, keyboard-operable way to every command. Only buttons the toolbar has
 * are offered.
 *
 * @license GPL-2.0-or-later
 */
import { h } from './dom.js';

const BUBBLE = [ 'bold', 'italic', 'underline', 'link', 'unlink' ];
const INSERT = [ 'image', 'object', 'file', 'table', 'custom', 'literal' ];

export class FloatingMenus {
    /**
     * @param {Object} ctx      { editor, t, instance }
     * @param {Object} commands the button registry
     * @param {Array}  names    the toolbar's resolved button names
     */
    constructor( ctx, commands, names ) {
        this.ctx = ctx;
        this.commands = commands;
        const has = ( n ) => names.indexOf( n ) !== -1 && commands[n] && !commands[n].select;
        this.bubbleButtons = BUBBLE.filter( has );
        this.insertButtons = INSERT.filter( has );
        this.controls = {};
        const t = ctx.t;

        this.bubble = h( 'div', { class: 'exp-oe-bubble', role: 'toolbar', 'aria-label': t( 'Formatting' ), hidden: true },
                         this.bubbleButtons.map( ( n ) => this.button( n ) ) );
        this.plusMenu = h( 'div', { class: 'exp-oe-plus-menu', role: 'menu', 'aria-label': t( 'Insert' ), hidden: true },
                           this.insertButtons.map( ( n ) => this.button( n, true ) ) );
        this.plus = h( 'button', {
            type: 'button', class: 'exp-oe-plus', title: t( 'Insert' ), 'aria-label': t( 'Insert' ),
            'aria-haspopup': 'menu', 'aria-expanded': 'false', hidden: true,
            onmousedown: ( e ) => e.preventDefault(),
            onclick: ( e ) => { e.preventDefault(); this.togglePlusMenu(); }
        }, [ h( 'span', { class: 'exp-oe-icon mce_plus', 'aria-hidden': 'true' } ) ] );
        this.element = h( 'div', { class: 'exp-oe-floating' }, [ this.bubble, this.plus, this.plusMenu ] );
        this.element.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Escape' ) {
                this.hideAll();
                ctx.editor.commands.focus();
            }
        } );
    }

    button( name, menuItem ) {
        const def = this.commands[name];
        const t = this.ctx.t;
        const label = def.label ? def.label( this.ctx ) : t( def.title );
        const b = h( 'button', {
            type: 'button', class: 'exp-oe-button exp-oe-button-' + name, title: label, 'aria-label': label,
            role: menuItem ? 'menuitem' : null,
            onmousedown: ( e ) => e.preventDefault(),
            onclick: ( e ) => {
                e.preventDefault();
                if ( b.disabled )
                    return;
                this.hidePlusMenu();
                def.run( this.ctx, b );
                this.ctx.instance.updateUI();
            }
        }, [ h( 'span', { class: 'exp-oe-icon mce_' + def.icon, 'aria-hidden': 'true' } ) ] );
        if ( def.active && !menuItem )
            b.setAttribute( 'aria-pressed', 'false' );
        this.controls[name] = b;
        return b;
    }

    hideAll() {
        this.bubble.hidden = true;
        this.plus.hidden = true;
        this.hidePlusMenu();
    }

    hidePlusMenu() {
        this.plusMenu.hidden = true;
        this.plus.setAttribute( 'aria-expanded', 'false' );
    }

    togglePlusMenu() {
        const open = this.plusMenu.hidden;
        this.plusMenu.hidden = !open;
        this.plus.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
        if ( open ) {
            this.plusMenu.style.top = ( this.plus.offsetTop + this.plus.offsetHeight + 4 ) + 'px';
            this.plusMenu.style.left = this.plus.offsetLeft + 'px';
            const first = this.plusMenu.querySelector( 'button:not([disabled])' );
            if ( first )
                first.focus();
        }
    }

    /** Called on every transaction, focus and blur: shows, places and updates the menus */
    update( hasFocus ) {
        const { editor, instance } = this.ctx;
        const view = editor.view;
        const within = this.element.contains( document.activeElement );
        if ( !instance.isEditable() || ( !hasFocus && !within ) ) {
            this.hideAll();
            return;
        }
        const { selection } = editor.state;
        // the menus are placed in the content area, which scrolls: its rectangle plus its scroll offset
        const area = this.element.parentNode;
        const rect = area.getBoundingClientRect();
        const frame = { left: rect.left - area.scrollLeft, top: rect.top - area.scrollTop };

        // bubble: text selected
        const textSelected = !selection.empty && !selection.node && this.bubbleButtons.length; // not a selected node (embed, table)
        if ( textSelected ) {
            for ( const [ name, b ] of Object.entries( this.controls ) ) {
                const def = this.commands[name];
                let enabled = true;
                try { enabled = def.enabled ? !!def.enabled( this.ctx ) : true; } catch ( e ) { enabled = false; }
                b.disabled = !enabled;
                if ( def.active && b.hasAttribute( 'aria-pressed' ) ) {
                    let active = false;
                    try { active = !!def.active( this.ctx ); } catch ( e ) {}
                    b.classList.toggle( 'exp-oe-active', active );
                    b.setAttribute( 'aria-pressed', active ? 'true' : 'false' );
                }
            }
            const start = view.coordsAtPos( selection.from );
            const end = view.coordsAtPos( selection.to );
            this.bubble.hidden = false;
            this.bubble.style.left = Math.max( 0, start.left - frame.left ) + 'px';
            // above the selection, or below it where the text area has no room above (first line)
            const above = start.top - frame.top - this.bubble.offsetHeight - 6;
            const areaTop = this.element.parentNode.scrollTop;
            this.bubble.style.top = ( above >= areaTop ? above : end.bottom - frame.top + 6 ) + 'px';
        }
        else if ( !within || !this.bubble.contains( document.activeElement ) )
            this.bubble.hidden = true;

        // "+": the cursor stands in an empty paragraph
        const parent = selection.$from && selection.$from.parent;
        const emptyLine = selection.empty && parent && parent.type.name === 'paragraph' && parent.content.size === 0 && this.insertButtons.length;
        if ( emptyLine ) {
            const at = view.coordsAtPos( selection.from );
            this.plus.hidden = false;
            this.plus.style.top = Math.max( 0, at.top - frame.top - 4 ) + 'px';
            this.plus.style.left = '4px';
        }
        else if ( !within ) {
            this.plus.hidden = true;
            this.hidePlusMenu();
        }
    }
}
