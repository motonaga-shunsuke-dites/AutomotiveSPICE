# ソフトウェアアーキテクチャ設計書 — ASPICE ドキュメント管理ツール

| 項目         | 内容                         |
|--------------|------------------------------|
| ドキュメントID | SAD_TOOL_001                |
| バージョン   | v1.0                         |
| 日付         | 2026-06-12                   |
| ステータス   | Approved                     |
| 関連プロセス | SWE.2                        |

---

## 1. アーキテクチャ概要

ローカル起動の **Node.js/Express サーバー + Vanilla JS ブラウザクライアント** 構成。  
サーバーはファイルシステム操作と静的ファイル配信を担い、クライアントは全 UI を担当する。

```
[ブラウザ]
  ├─ portal.html    ← ポータル (SWR-001, 013, 014)
  ├─ editor.html    ← エディター (SWR-002, 003, 005, 006)
  ├─ viewer.html    ← ビューアー (SWR-004)
  └─ traceability.html ← トレーサビリティ (SWR-010, 011)
        │  HTTP REST
[Node.js/Express server.js :3000]
  ├─ /api/workspace   ← ワークスペース設定 (SWR-007)
  ├─ /api/documents   ← ドキュメント CRUD (SWR-002〜005)
  └─ /api/traceability ← 影響範囲 (SWR-010, 011)
        │  fs
[ワークスペースフォルダ]
  └─ {process}/{id}.json
```

---

## 2. コンポーネント構成

| ARC-ID  | コンポーネント名       | 責務                                              | 担当 SWR              |
|---------|----------------------|---------------------------------------------------|----------------------|
| ARC-001 | Express Server       | HTTP サーバー・静的配信・ルーティング              | SWR-N01, SWR-N04     |
| ARC-002 | Document API         | ドキュメント CRUD・ファイル I/O・アンドゥ履歴保持  | SWR-002, 003, 006, 009 |
| ARC-003 | Workspace API        | ワークスペースパス保存・読み込み                  | SWR-007              |
| ARC-004 | Traceability API     | トレーサビリティグラフ構築・影響範囲計算          | SWR-010, 011         |
| ARC-005 | Client Shared        | API クライアント・アンドゥマネージャー・ユーティリティ | SWR-006           |
| ARC-006 | Client Pages         | portal/editor/viewer/traceability の UI ロジック  | SWR-001〜005, 008〜014 |

---

## 3. インターフェース設計 (REST API)

| IFC-ID  | エンドポイント              | メソッド | リクエスト/レスポンス                             |
|---------|-----------------------------|---------|--------------------------------------------------|
| IFC-001 | `/api/workspace`            | GET     | → `{ path, projectId }`                         |
| IFC-002 | `/api/workspace`            | POST    | `{ path, projectId }` → `{ ok }`                |
| IFC-003 | `/api/documents`            | GET     | `?process=SWE1` → `{ documents: DocMeta[] }`    |
| IFC-004 | `/api/documents/:id`        | GET     | → `Document`                                     |
| IFC-005 | `/api/documents`            | POST    | `NewDoc` → `Document`                            |
| IFC-006 | `/api/documents/:id`        | PUT     | `Partial<Document>` → `Document`                 |
| IFC-007 | `/api/documents/:id`        | DELETE  | → `{ ok }`                                       |
| IFC-008 | `/api/traceability`         | GET     | → `TraceMatrix`                                  |
| IFC-009 | `/api/impact/:id`           | GET     | → `{ id, affected: string[] }`                  |

---

## 4. ドキュメント JSON 形式

```json
{
  "id":         "SRS_TOOL_001",
  "type":       "SRS",
  "process":    "SWE1",
  "title":      "...",
  "version":    "1.0",
  "status":     "Draft | Under Review | Approved",
  "created":    "2026-06-12",
  "modified":   "2026-06-12",
  "author":     "",
  "approver":   "",
  "upstream":   ["doc_id"],
  "downstream": [],
  "content":    { /* スキーマ依存 */ },
  "changelog":  [{ "version": "1.0", "date": "...", "summary": "...", "snapshot": {} }]
}
```

---

## 5. ファイル構成

```
tools/
├── tool-design/              # 本設計ドキュメント (ユーザー参照用)
├── server.js                 # ARC-001: Express エントリポイント
├── routes/
│   ├── documents.js          # ARC-002: ドキュメント API
│   ├── workspace.js          # ARC-003: ワークスペース API
│   └── traceability.js       # ARC-004: トレーサビリティ API
├── services/
│   ├── fileService.js        # ファイル I/O ロジック
│   └── traceService.js       # グラフ・影響計算ロジック
├── schemas/
│   └── document_types.json   # 全ドキュメント型定義
├── client/                   # ARC-005, 006: フロントエンド
│   ├── css/styles.css
│   ├── js/
│   │   ├── api.js            # ARC-005: REST クライアント
│   │   ├── undoManager.js    # ARC-005: アンドゥ管理
│   │   └── utils.js          # ARC-005: 共通ユーティリティ
│   ├── portal.html / portal.js
│   ├── editor.html / editor.js
│   ├── viewer.html / viewer.js
│   └── traceability.html / traceability.js
├── package.json
├── install.bat               # 初回セットアップ
└── launch.bat                # サーバー起動 + ブラウザオープン
```

---

## 6. トレーサビリティ

| SWR-ID  | 担当 ARC |
|---------|---------|
| SWR-001, 013, 014 | ARC-002, ARC-006 (portal) |
| SWR-002, 003, 005 | ARC-002, ARC-006 (editor) |
| SWR-004           | ARC-002, ARC-006 (viewer) |
| SWR-006           | ARC-002, ARC-005 |
| SWR-007           | ARC-003 |
| SWR-008           | ARC-001 (launch.bat) |
| SWR-009           | ARC-006 全ページ |
| SWR-010, 011      | ARC-004, ARC-006 (traceability) |
| SWR-012           | ARC-006 (CSS) |

---

## 変更履歴

| バージョン | 日付       | 変更概要 | 作成/変更者 | レビュー者 |
|-----------|------------|---------|------------|-----------|
| 1.0       | 2026-06-12 | 初版作成 | -          | -         |
