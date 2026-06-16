/**
 * view-channels.js — Controlador de la vista principal de Canales
 */
const ViewChannels = (() => {
  let _keysBound = false;
  let _sidebarFocusIdx = 2; // 0=search, 1=setup, 2+=groups
  let _focusZone = 'channels'; // 'groups' | 'channels' | 'exit'
  let _exitFocusIdx = 0; // 0 = Cancel, 1 = Exit
  let _prevFocusZone = 'channels';
  let _sidebarFocusablesCache = null;

  function onShow() {
    initKeys();
    _updateGroupCounts();
    if (typeof VirtualList !== 'undefined' && _focusZone === 'channels') {
      VirtualList.setFocused(VirtualList.getFocused());
      setTimeout(() => {
        const target = document.querySelector('.channel-card.focused') || document.querySelector('.channel-card');
        if (target) KeyHandler.setFocus(target);
      }, 50);
    }
    // Si el reproductor tiene canal en PiP, reafirmar su posición
    if (typeof Player !== 'undefined') {
      if (Player.getMode() === 'PIP' && Player.getCurrent()) {
        Player.reapplyPip();
      }
    }
  }

  function renderGroups() {
    const list = document.getElementById('group-list');
    if (!list) return;
    list.innerHTML = '';
    const groups = Store.get('groups');
    const channels = Store.get('channels');
    const currentGroup = Store.get('currentGroup');
    const groupIdx = Store.get('groupIdx') || 0;

    groups.forEach((g, i) => {
      const cnt = g.id === '__all__'  ? channels.length :
                  g.id === '__favs__' ? Favorites.getIds().length :
                  channels.filter(c => c.group === g.id).length;
      const li = document.createElement('li');
      li.className = 'group-item' + (i === groupIdx ? ' focused' : '') + (g.id === currentGroup ? ' active' : '');
      li.dataset.idx = i;
      li.innerHTML = `<span>${g.name}</span><span class="group-count">${cnt}</span>`;
      li.addEventListener('click', () => { Store.set('groupIdx', i); _selectGroup(g); });
      list.appendChild(li);
    });
  }

  function _updateGroupClasses() {
    const groups = Store.get('groups');
    const currentGroup = Store.get('currentGroup');
    const groupIdx = Store.get('groupIdx');
    const els = document.querySelectorAll('.group-item');
    els.forEach((el, i) => {
      el.classList.toggle('focused', i === groupIdx);
      el.classList.toggle('active', groups[i]?.id === currentGroup);
    });
    _sidebarFocusablesCache = null;
  }

  function _updateGroupCounts() {
    let cache = Store.get('groupCountsCache');
    const channels = Store.get('channels');
    const groups = Store.get('groups');

    if (!cache) {
      cache = { '__all__': channels.length };
      for (const ch of channels) {
        cache[ch.group] = (cache[ch.group] || 0) + 1;
      }
      Store.set('groupCountsCache', cache);
    }
    cache['__favs__'] = Favorites.getIds().length;

    const els = document.querySelectorAll('.group-item');
    if (!els.length || !groups.length) return;
    els.forEach((el, i) => {
      const g = groups[i];
      if (!g) return;
      const countEl = el.querySelector('.group-count');
      if (countEl) countEl.textContent = cache[g.id] || 0;
    });
  }

  function _getSidebarFocusables() {
    if (_sidebarFocusablesCache) return _sidebarFocusablesCache;
    const list = [];
    const bs = document.getElementById('btn-open-search');
    const bc = document.getElementById('btn-open-setup');
    if (bs) list.push(bs);
    if (bc) list.push(bc);
    list.push(...Array.from(document.querySelectorAll('.group-item')));
    _sidebarFocusablesCache = list;
    return list;
  }

  function _selectGroup(group) {
    if (!group) return;
    const groups = Store.get('groups');
    Store.set('currentGroup', group.id);
    const gIdx = groups.findIndex(g => g.id === group.id);
    Store.set('groupIdx', gIdx);
    _sidebarFocusIdx = gIdx + 2;
    _updateGroupClasses();
    renderChannels();
    _setFocusZone('channels');
  }

  function renderChannels(list) {
    const channels = Store.get('channels');
    const currentGroup = Store.get('currentGroup');
    const favIds = new Set(Favorites.getIds());
    let items;
    if (list) {
      items = list;
    } else {
      items = Playlist.filterByGroup(channels, currentGroup, favIds);
    }

    const cnt = document.getElementById('channel-count');
    if (cnt) cnt.textContent = items.length + ' canales';

    VirtualList.init({
      containerId:  'channel-grid',
      items,
      onSelect:     ch => _playChannel(ch),
      getFavBadge:  id => Favorites.isFav(id)
    });

    _updateGroupCounts();
  }

  function _playChannel(ch) {
    if (!ch) return;
    Storage.setLastChannel(ch.id);

    if (typeof Player !== 'undefined' && Player.getMode() === 'PIP' && Player.getCurrent()?.id === ch.id) {
      Player.expandToFullscreen();
      Router.showView('player');
      document.getElementById('view-player').focus();
      return;
    }

    Router.showView('player');
    document.getElementById('view-player').focus();
    Player.play(ch);
  }

  function _moveActive(dir) {
    if (_focusZone === 'groups') {
      const els = _getSidebarFocusables();
      if (!els.length) return;
      els[_sidebarFocusIdx]?.classList.remove('focused');

      if (dir === 'left') {
        if (_sidebarFocusIdx === 1) _sidebarFocusIdx = 0;
      } else if (dir === 'right') {
        if (_sidebarFocusIdx === 0) {
          _sidebarFocusIdx = 1;
        } else {
          _setFocusZone('channels');
          return;
        }
      } else if (dir === 'up') {
        if (_sidebarFocusIdx === 2) {
          _sidebarFocusIdx = 0;
        } else if (_sidebarFocusIdx > 2) {
          _sidebarFocusIdx--;
        }
      } else if (dir === 'down') {
        if (_sidebarFocusIdx === 0 || _sidebarFocusIdx === 1) {
          _sidebarFocusIdx = 2;
        } else {
          _sidebarFocusIdx = Math.min(els.length - 1, _sidebarFocusIdx + 1);
        }
      }

      const next = els[_sidebarFocusIdx];
      if (next) {
        next.classList.add('focused');
        next.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    } else {
      const curIdx = VirtualList.getFocused();

      if (dir === 'left' && curIdx % 3 === 0) {
        _setFocusZone('groups');
        return;
      }

      VirtualList.move(dir);
      KeyHandler.setFocus(document.querySelector('.channel-card.focused'), true);
      
      const focused = VirtualList.getCurrentItem();
      if (focused && typeof Player !== 'undefined') {
        if (Storage.getPipEnabled()) {
          Player.schedulePreview(focused);
        } else {
          Player.cancelPreview();
        }
      }
    }
  }

  function _setFocusZone(zone) {
    _focusZone = zone;
    if (zone === 'groups') {
      document.querySelector('.channel-card.focused')?.classList.remove('focused');
      const els = _getSidebarFocusables();
      const next = els[_sidebarFocusIdx];
      if (next) next.classList.add('focused');
    } else if (zone === 'channels') {
      document.querySelectorAll('.sidebar-btn.focused, .group-item.focused').forEach(e => e.classList.remove('focused'));
      if (typeof VirtualList !== 'undefined') {
        VirtualList.setFocused(VirtualList.getFocused());
      }
      setTimeout(() => {
        KeyHandler.setFocus(document.querySelector('.channel-card.focused') || document.querySelector('.channel-card'), true);
      }, 50);
    }
  }

  function _showExitPopup() {
    _prevFocusZone = _focusZone;
    _focusZone = 'exit';
    _exitFocusIdx = 0;
    const el = document.getElementById('exit-popup');
    if (el) el.classList.remove('hidden');
    _updateExitFocus();
  }

  function _hideExitPopup() {
    _focusZone = _prevFocusZone;
    const el = document.getElementById('exit-popup');
    if (el) el.classList.add('hidden');
  }

  function _moveExit(dir) {
    if (dir === 'left') _exitFocusIdx = 0;
    else if (dir === 'right') _exitFocusIdx = 1;
    _updateExitFocus();
  }

  function _updateExitFocus() {
    const cancel = document.getElementById('btn-exit-cancel');
    const confirm = document.getElementById('btn-exit-confirm');
    if (cancel) cancel.classList.toggle('focused', _exitFocusIdx === 0);
    if (confirm) confirm.classList.toggle('focused', _exitFocusIdx === 1);
  }

  function refreshUI() {
    _updateGroupCounts();
    if (typeof VirtualList !== 'undefined') {
      VirtualList.refreshVisible();
    }
  }

  function initKeys() {
    if (_keysBound) return;
    _keysBound = true;

    KeyHandler.on('LEFT',  () => { 
      if (Router.isView('channels')) { 
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return false;
        if (_focusZone === 'exit') { _moveExit('left'); return true; }
        _moveActive('left'); return true; 
      } 
    });
    KeyHandler.on('RIGHT', () => { 
      if (Router.isView('channels')) { 
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return false;
        if (_focusZone === 'exit') { _moveExit('right'); return true; }
        _moveActive('right'); return true; 
      } 
    });
    KeyHandler.on('UP',    () => { 
      if (Router.isView('channels') && _focusZone !== 'exit') { 
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return false;
        _moveActive('up'); return true; 
      } 
    });
    KeyHandler.on('DOWN',  () => { 
      if (Router.isView('channels') && _focusZone !== 'exit') { 
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
          _setFocusZone('channels');
          return true;
        }
        _moveActive('down'); return true; 
      } 
    });

    KeyHandler.on('ENTER', () => {
      if (!Router.isView('channels')) return;
      
      if (_focusZone === 'groups') {
        const els = _getSidebarFocusables();
        const el = els[_sidebarFocusIdx];
        if (!el) return;
        if (el.id === 'btn-open-search') {
          Search.open();
        } else if (el.id === 'btn-open-setup') {
          Router.showView('setup');
        } else {
          const gIdx = _sidebarFocusIdx - 2;
          const groups = Store.get('groups');
          if (groups[gIdx]) _selectGroup(groups[gIdx]);
        }
        return true;
      }
      
      if (_focusZone === 'channels') {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return false;
        const ch = VirtualList.getCurrentItem();
        if (ch) _playChannel(ch);
        return true;
      }

      if (_focusZone === 'exit') {
        if (_exitFocusIdx === 0) {
          _hideExitPopup();
        } else {
          try { tizen?.application?.getCurrentApplication()?.exit(); } catch(e) {}
        }
        return true;
      }
    });

    KeyHandler.on('LONG_OK', () => {
      if (Router.isView('channels') && _focusZone === 'channels') {
        const ch = VirtualList.getCurrentItem();
        if (ch) { 
          Favorites.toggle(ch.id); 
          _updateGroupCounts();
          
          if (Store.get('currentGroup') === '__favs__') {
            renderChannels(); 
          } else {
            VirtualList.refreshVisible(); 
          }
        }
      }
      return true;
    });

    KeyHandler.on('BACK', () => {
      if (Router.isView('channels')) {
        if (Search.isOpen()) { Search.close(); return true; }
        if (_focusZone === 'exit') { _hideExitPopup(); return true; }
        
        if (_focusZone === 'channels') {
          _setFocusZone('groups');
        } else {
          _showExitPopup();
        }
        return true;
      }
    });

    document.getElementById('btn-open-search')?.addEventListener('click', () => Search.open());
    document.getElementById('btn-open-setup')?.addEventListener('click', () => { Router.showView('setup'); });
  }

  function playChannelRelative(dir) {
    const cur  = Player.getCurrent();
    if (!cur) return;
    const curIdx = VirtualList.getFocused();
    const nextIdx = dir === 'next' ? curIdx + 1 : curIdx - 1;
    const next = VirtualList.getItem(nextIdx);
    if (next) { VirtualList.setFocused(nextIdx); _playChannel(next); }
  }

  return { onShow, renderGroups, renderChannels, refreshUI, playChannelRelative };
})();
