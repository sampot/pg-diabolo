# pg-diabolo

**扯鈴**：節奏連招。兩根棒＋繩＋鈴，螢幕出現節拍點，玩家在拍點按對應鍵／鈕觸發「抖鈴／拋鈴／接鈴」連招。節奏正確累加 combo，miss 斷 combo；難度隨時間提升（拍速加快）。目標衝高 combo／分數。純前端、零依賴、零 build 步驟。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

```
https://play.samkuo.me/?open=sampot/pg-diabolo&name=扯鈴&fresh=1
```

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

點一下頁面後音效才會出聲。

## 操作

| 動作 | 觸控 | 鍵盤 |
| --- | --- | --- |
| 抖鈴 | 〈抖鈴〉鈕 | `J` |
| 拋鈴 | 〈拋鈴〉鈕 | `K` |
| 接鈴 | 〈接鈴〉鈕 | `L` |
| 開局 | 〈開局〉鈕 | `空白`／`Enter` |
| 音效開／關 | 〈音效開／關〉 | — |

## 規則

- 節拍點從右滑向黃色判定線，在落到線上的拍點按下對應動作。
- 判定：`perfect`（±0.056s）／`good`（±0.16s）／`miss`。
- 命中 +10 分（perfect +15）；連招每 10 下再加 25 分。
- 漏拍或按錯動作 → 斷 combo。
- 難度每 5 秒提升一級，拍速從 66 BPM 加快到 150 BPM。
- 45 秒一局。最佳分數存於 KV 鍵 `pg-diabolo-best`（同時輕量暫存 `localStorage`）；無 KV 環境照玩不報錯。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構 |
| `styles.css` | 亮／暗主題（mobile-first） |
| `app.js` | DOM／canvas 渲染 ＋ 互動 ＋ 最高分 KV |
| `game.js` | 純函式規則邏輯（節拍、判定、combo、難度） |
| `game.test.js` | Vitest 單元測試 |
| `audio.js` | Web Audio 合成音效 |
| `functions.js` | Playgrounds stub |
| `assets/` | 拷入的 CC0 音效 |

## 技術

- 純 HTML＋CSS＋JS，ES module，無依賴、無 build。
- 節拍以「時間點＋動作」結構表示，判定窗制，難度為時間分段曲線。
- 測試：`cd pg-diabolo && npx --yes vitest@latest run`。

## 授權

本 repo 程式碼為 MIT（作者 sampot）。`assets/` 內素材來源與授權見 `ATTRIBUTION.md`。