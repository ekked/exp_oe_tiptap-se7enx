/**
 * The find and replace bar between the toolbar and the text (editor/search.js does the finding). Ctrl+F in the text
 * opens it with the selected text, the toolbar's search and replace buttons (ezoe's names) too.
 *
 * Keyboard: Enter in the find field goes to the next match, Shift+Enter to the previous one, F3 / Shift+F3 too (also
 * in the text); Enter in the replace field replaces the current match; Escape closes the bar, selects the current
 * match and returns to the text; Ctrl+F in the bar selects the find field. The number of matches is announced
 * (aria-live). Replacing is off while the editor is read only.
 *
 * @license GPL-2.0-or-later
 */
import { TextSelection } from '@tiptap/pm/state';
import { h } from './dom.js';
import { setSearch, goTo, replaceCurrent, replaceAll, clearSearch, searchState } from '../editor/search.js';

let bars = 0;

export class SearchBar {
    constructor( ctx ) {
        this.ctx = ctx;
        const t = ctx.t, id = 'exp-oe-search-' + ( ++bars );
        this.find = h( 'input', { type: 'search', id: id + '-find', class: 'exp-oe-search-find', autocomplete: 'off', spellcheck: 'false' } );
        this.replace = h( 'input', { type: 'text', id: id + '-replace', class: 'exp-oe-search-replace', autocomplete: 'off', spellcheck: 'false' } );
        this.matchCase = h( 'input', { type: 'checkbox', id: id + '-case' } );
        this.status = h( 'span', { class: 'exp-oe-search-status', role: 'status', 'aria-live': 'polite' } );
        const button = ( text, icon, onclick, extra ) => h( 'button', Object.assign( {
            type: 'button', class: 'exp-oe-search-button' + ( icon ? ' exp-oe-search-icon-button' : '' ), title: text, 'aria-label': icon ? text : null,
            onmousedown: ( e ) => e.preventDefault(), onclick
        }, extra || {} ), icon ? h( 'span', { class: 'exp-oe-icon mce_' + icon, 'aria-hidden': 'true' } ) : text );
        this.prevButton = button( t( 'Previous match (Shift+Enter)' ), 'search_prev', () => this.go( -1 ) );
        this.nextButton = button( t( 'Next match (Enter)' ), 'search_next', () => this.go( 1 ) );
        this.replaceButton = button( t( 'Replace' ), '', () => this.replaceOne() );
        this.replaceAllButton = button( t( 'Replace all' ), '', () => this.replaceEvery() );
        const close = button( t( 'Close' ), 'close', () => this.close( true ), { class: 'exp-oe-search-button exp-oe-search-icon-button exp-oe-search-close' } );
        this.element = h( 'div', { class: 'exp-oe-searchbar', role: 'search', 'aria-label': t( 'Find and replace' ), hidden: true }, [
            h( 'div', { class: 'exp-oe-search-row' }, [
                h( 'label', { for: this.find.id, class: 'exp-oe-search-label', text: t( 'Find' ) } ), this.find,
                this.prevButton, this.nextButton,
                h( 'label', { class: 'exp-oe-search-case', for: this.matchCase.id }, [ this.matchCase, ' ' + t( 'Match case' ) ] ),
                this.status, close
            ] ),
            h( 'div', { class: 'exp-oe-search-row' }, [
                h( 'label', { for: this.replace.id, class: 'exp-oe-search-label', text: t( 'Replace with' ) } ), this.replace,
                this.replaceButton, this.replaceAllButton
            ] )
        ] );
        this.find.addEventListener( 'input', () => this.search() );
        this.matchCase.addEventListener( 'change', () => this.search() );
        this.element.addEventListener( 'keydown', ( e ) => this.onKey( e ) );
    }

    get view() {
        return this.ctx.editor.view;
    }

    isOpen() {
        return !this.element.hidden;
    }

    /**
     * Shows the bar with the selected text (one line) as the query.
     * @param {boolean} replace the focus goes to the replace field when there is a query
     */
    open( replace ) {
        const { state } = this.view;
        const selected = state.selection.empty ? '' : state.doc.textBetween( state.selection.from, state.selection.to, '\n' );
        if ( selected && selected.indexOf( '\n' ) === -1 && selected.length < 200 )
            this.find.value = selected;
        this.element.hidden = false;
        this.update();
        this.search();
        const field = replace && this.find.value && this.ctx.instance.isEditable() ? this.replace : this.find;
        field.focus();
        field.select();
    }

    /** @param {boolean} focusText back to the text, with the current match selected */
    close( focusText ) {
        if ( this.element.hidden )
            return;
        this.element.hidden = true;
        if ( !this.ctx.editor.isDestroyed ) {
            // the current match stays selected in the text
            const s = searchState( this.view.state ), m = s.matches[s.current];
            if ( focusText && m )
                this.view.dispatch( this.view.state.tr.setSelection( TextSelection.create( this.view.state.doc, m.from, m.to ) ) );
            clearSearch( this.view );
            if ( focusText )
                this.view.focus();
        }
    }

    search() {
        this.report( setSearch( this.view, this.find.value, this.matchCase.checked ) );
    }

    go( dir ) {
        if ( !searchState( this.view.state ).query )
            this.search();
        this.report( goTo( this.view, dir ) );
    }

    replaceOne() {
        if ( !this.ctx.instance.isEditable() )
            return;
        this.report( replaceCurrent( this.view, this.replace.value ) );
    }

    replaceEvery() {
        if ( !this.ctx.instance.isEditable() )
            return;
        const n = replaceAll( this.view, this.replace.value );
        this.report( searchState( this.view.state ), this.ctx.t( '%n replaced' ).replace( '%n', n ) );
    }

    /** The count and the buttons after a change of the text */
    refresh() {
        if ( !this.reporting )
            this.report( searchState( this.view.state ) );
    }

    report( s, text ) {
        const { t } = this.ctx;
        if ( text )
            this.status.textContent = text;
        else if ( !s.query )
            this.status.textContent = '';
        else if ( !s.matches.length )
            this.status.textContent = t( 'No matches' );
        else
            this.status.textContent = t( '%1 of %2' ).replace( '%1', s.current + 1 ).replace( '%2', s.matches.length );
        this.find.setAttribute( 'aria-invalid', s.query && !s.matches.length ? 'true' : 'false' );
        this.update();
    }

    /** Buttons that cannot act are disabled; replacing needs an editable text */
    update() {
        const s = searchState( this.view.state ), editable = this.ctx.instance.isEditable();
        this.prevButton.disabled = this.nextButton.disabled = !s.matches.length;
        this.replaceButton.disabled = this.replaceAllButton.disabled = !s.matches.length || !editable;
        this.replace.disabled = !editable;
    }

    onKey( e ) {
        const mod = e.ctrlKey || e.metaKey;
        if ( e.key === 'Escape' ) {
            e.preventDefault();
            e.stopPropagation();
            this.close( true );
        }
        else if ( e.key === 'Enter' && e.target === this.find ) {
            e.preventDefault();
            this.go( e.shiftKey ? -1 : 1 );
        }
        else if ( e.key === 'Enter' && e.target === this.replace ) {
            e.preventDefault();
            this.replaceOne();
        }
        else if ( e.key === 'F3' ) {
            e.preventDefault();
            this.go( e.shiftKey ? -1 : 1 );
        }
        else if ( mod && !e.altKey && ( e.key === 'f' || e.key === 'F' ) ) {
            e.preventDefault();
            this.find.focus();
            this.find.select();
        }
        // a form submit by Enter never comes from the bar
        if ( e.key === 'Enter' )
            e.stopPropagation();
    }
}
