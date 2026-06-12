// スナップショットベースのアンドゥ/リドゥ管理 (最大50ステップ)
class UndoManager {
  constructor() {
    this._history = [];
    this._index = -1;
    this._maxSize = 50;
  }

  push(state) {
    // リドゥ履歴を破棄
    this._history = this._history.slice(0, this._index + 1);
    this._history.push(JSON.parse(JSON.stringify(state)));
    if (this._history.length > this._maxSize) this._history.shift();
    this._index = this._history.length - 1;
    this._notify();
  }

  undo() {
    if (!this.canUndo()) return null;
    this._index--;
    this._notify();
    return JSON.parse(JSON.stringify(this._history[this._index]));
  }

  redo() {
    if (!this.canRedo()) return null;
    this._index++;
    this._notify();
    return JSON.parse(JSON.stringify(this._history[this._index]));
  }

  canUndo() { return this._index > 0; }
  canRedo()  { return this._index < this._history.length - 1; }
  clear()    { this._history = []; this._index = -1; this._notify(); }

  _notify() {
    window.dispatchEvent(new CustomEvent('undo-state-changed', {
      detail: { canUndo: this.canUndo(), canRedo: this.canRedo() }
    }));
  }
}
