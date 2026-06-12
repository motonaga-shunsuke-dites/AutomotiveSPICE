# ソフトウェア詳細設計書 — ASPICE ドキュメント管理ツール

| 項目         | 内容                         |
|--------------|------------------------------|
| ドキュメントID | SDD_TOOL_001                |
| バージョン   | v1.0                         |
| 日付         | 2026-06-12                   |
| ステータス   | Approved                     |
| 関連プロセス | SWE.3                        |

---

## 1. ユニット一覧

| UNT-ID  | ファイル                     | 親 ARC  | 責務                               |
|---------|------------------------------|---------|------------------------------------|
| UNT-001 | server.js                    | ARC-001 | Express 設定・ルート登録・起動     |
| UNT-002 | routes/documents.js          | ARC-002 | ドキュメント CRUD ルートハンドラ   |
| UNT-003 | routes/workspace.js          | ARC-003 | ワークスペース設定ルートハンドラ   |
| UNT-004 | routes/traceability.js       | ARC-004 | トレーサビリティルートハンドラ     |
| UNT-005 | services/fileService.js      | ARC-002 | JSON ファイル読み書き・ディレクトリ管理 |
| UNT-006 | services/traceService.js     | ARC-004 | 依存グラフ構築・影響範囲計算       |
| UNT-007 | schemas/document_types.json  | ARC-002 | 全ドキュメント型のフォームスキーマ |
| UNT-008 | client/js/api.js             | ARC-005 | fetch ラッパー・REST API クライアント |
| UNT-009 | client/js/undoManager.js     | ARC-005 | スナップショットベースのアンドゥ管理 |
| UNT-010 | client/js/utils.js           | ARC-005 | 共通ヘルパー関数                   |
| UNT-011 | client/css/styles.css        | ARC-006 | 全ページ共通スタイル               |
| UNT-012 | client/portal.html/js        | ARC-006 | ポータルページ UI                  |
| UNT-013 | client/editor.html/js        | ARC-006 | エディターページ UI                |
| UNT-014 | client/viewer.html/js        | ARC-006 | ビューアーページ UI                |
| UNT-015 | client/traceability.html/js  | ARC-006 | トレーサビリティページ UI          |

---

## 2. 主要データ構造

### 2.1 スキーマ定義 (document_types.json)

```json
{
  "SWE1_SRS": {
    "label": "ソフトウェア要件仕様書",
    "process": "SWE1",
    "idPrefix": "SRS",
    "sections": [
      {
        "id": "header",
        "title": "基本情報",
        "fields": [
          { "id": "title", "label": "タイトル", "type": "text", "required": true },
          { "id": "status", "label": "ステータス", "type": "select",
            "options": ["Draft", "Under Review", "Approved"] },
          { "id": "author", "label": "作成者", "type": "text" },
          { "id": "approver", "label": "承認者", "type": "text" }
        ]
      },
      {
        "id": "requirements",
        "title": "機能要件",
        "type": "itemList",
        "itemFields": [
          { "id": "id",          "label": "ID",       "type": "text", "pattern": "SWR-\\d{3}" },
          { "id": "title",       "label": "タイトル", "type": "text" },
          { "id": "description", "label": "説明",     "type": "textarea" },
          { "id": "priority",    "label": "優先度",   "type": "select",
            "options": ["Must", "Should", "Nice-to-have"] },
          { "id": "source",      "label": "根拠",     "type": "text" },
          { "id": "acceptance",  "label": "受入基準", "type": "textarea" },
          { "id": "status",      "label": "状態",     "type": "select",
            "options": ["Draft", "Agreed", "Deleted"] }
        ]
      }
    ]
  }
}
```

### 2.2 ワークスペース設定 (.workspace.json)

```json
{ "path": "C:\\Projects\\MyProject\\documents", "projectId": "PRJ001" }
```

---

## 3. 主要関数仕様

### UNT-005: fileService.js

| 関数              | 引数                   | 戻り値           | 処理                              |
|-------------------|------------------------|------------------|-----------------------------------|
| `readDoc(id)`     | id: string             | Promise\<Doc\>   | JSON ファイルを読み込む           |
| `writeDoc(doc)`   | doc: Document          | Promise\<void\>  | JSON ファイルに書き込む + 変更履歴追記 |
| `deleteDoc(id)`   | id: string             | Promise\<void\>  | ファイル削除                      |
| `listDocs(proc?)` | proc?: string          | Promise\<Meta[]\> | ドキュメント一覧を返す           |
| `getWorkspace()`  | -                      | WorkspaceConfig  | .workspace.json を読み込む       |
| `setWorkspace(c)` | c: WorkspaceConfig     | void             | .workspace.json に書き込む       |

### UNT-009: undoManager.js

| 関数        | 説明                                  |
|-------------|---------------------------------------|
| `push(state)` | 現在の状態スナップショットを履歴に追加 (最大50件) |
| `undo()`    | 1つ前のスナップショットを返し、ポインタを戻す |
| `redo()`    | 1つ後のスナップショットを返し、ポインタを進める |
| `canUndo()` | boolean                               |
| `canRedo()` | boolean                               |
| `clear()`   | 履歴をクリア                          |

---

## 4. エラー処理

| エラー種別         | 発生箇所       | 処理方法                         |
|-------------------|----------------|----------------------------------|
| ワークスペース未設定 | API 呼び出し時 | 409 を返し、クライアントが設定画面を表示 |
| ファイル読み書き失敗 | fileService    | 500 + エラー詳細をログ出力       |
| 不正な JSON        | readDoc        | 400 + エラーメッセージ返却       |
| ポート使用中       | server.js 起動時 | エラーメッセージを表示して終了   |

---

## 5. UI レイアウト設計

```
┌─────────────── ナビゲーションバー (高さ 48px) ────────────────┐
│ [ASPICE Tools] [Portal] [Editor] [Viewer] [Traceability]     │
├──────────────────────────────────────────────────────────────┤
│ サイドバー (幅 240px, リサイズ可) │ メインエリア (残余幅)      │
│  - ドキュメントツリー            │                            │
│  - 検索フィールド                │  ページ固有コンテンツ       │
│  - 新規作成ボタン                │                            │
└──────────────────────────────────────────────────────────────┘
```

エディターのメインエリア:
```
┌───────────────────────────────────────────┐
│ [フォームビュー] [Markdown] タブ切替        │
├────────────────────────┬──────────────────┤
│ フォーム入力エリア      │ ライブプレビュー  │
│ (スクロール可)         │ (スクロール可)    │
└────────────────────────┴──────────────────┘
```

---

## 変更履歴

| バージョン | 日付       | 変更概要 | 作成/変更者 | レビュー者 |
|-----------|------------|---------|------------|-----------|
| 1.0       | 2026-06-12 | 初版作成 | -          | -         |
