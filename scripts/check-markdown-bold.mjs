#!/usr/bin/env node
/**
 * check-markdown-bold.mjs
 *
 * 检测 Markdown 粗体 `**...**` 中会被渲染器误判、导致不显示粗体的分隔符。
 *
 * 起因（已用 @astrojs/markdown-remark 复现）：
 *   **两个工具调用。**搜索   → 渲染失败，输出字面 `**`
 *   **前后是中文**直接连中文 → 正常
 *   **bold**normal           → 正常
 *
 * 规则：闭合 `**` 若 **前**紧跟标点、**后**紧跟非标点非空白字符（如中文），
 * 会被判定为「左包围（left-flanking）」而当作开标签，导致粗体不闭合、原样输出 `**`。
 * 修复方式：把该对分隔符换成 `<strong>...</strong>`（避免在中文里插入空格）。
 *
 * 用法：
 *   node scripts/check-markdown-bold.mjs            # 检查全部文章（src/content/news/*.md）
 *   node scripts/check-markdown-bold.mjs <file>…  # 指定文件
 *
 * 退出码：发现问题时返回 1，否则 0。
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const ASCII_PUNCT = new Set('.,;:!?()[]{}<>');
const CJK_PUNCT = new Set('，。；：！？、）》】』「」『』《〈〉》（）：）』…—·　');
// 闭合 ** 之后为标点 → 渲染正常（记为“干净”）；之前为标点 → 可能左包围 → 失败
const CLEAN_AFTER = new Set([...ASCII_PUNCT, ...CJK_PUNCT]);
const PRE = CJK_PUNCT;
const GLOB = 'src/content/news/*.md';
const CODE_FENCE = /^\s*```/;

/**
 * 返回需要把分隔符替换为 <strong>/</strong> 的一对 `**`。
 * 以段落为单位调用（不跨行配对开闭）。
 */
function findBoldPairs(line) {
  if (CODE_FENCE.test(line)) return [];
  const positions = [];
  let j = 0;
  while (true) {
    j = line.indexOf('**', j);
    if (j === -1) break;
    positions.push(j);
    j += 2;
  }
  if (!positions.length) return [];

  const fix = new Map(); // index -> 's' | 'e'
  const stack = [];
  for (const idx of positions) {
    if (stack.length) {
      const openIdx = stack.pop();
      const closeIdx = idx;
      const before = line[closeIdx - 1];
      const after = line[closeIdx + 2];
      if (before === undefined || after === undefined) continue;
      if (after === '*' || after === ' ' || CLEAN_AFTER.has(after)) continue;
      if (PRE.has(before)) {
        fix.set(openIdx, 's');
        fix.set(closeIdx, 'e');
      }
    } else {
      stack.push(idx);
    }
  }
  return fix;
}

/** 将修复映射应用到一行，返回 (修复后的行, 修复对数)。 */
function applyFixes(line, fix) {
  if (!fix.size) return [line, 0];
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (fix.has(i)) {
      out.push(fix.get(i) === 's' ? '<strong>' : '</strong>');
      i += 2;
    } else {
      out.push(line[i]);
      i += 1;
    }
  }
  return [out.join(''), fix.size / 2];
}

function main() {
  const files = process.argv.slice(2);
  const paths = files.length ? files : globSync(GLOB);
  let total = 0;
  let issues = 0;

  for (const p of paths) {
    const lines = readFileSync(p, 'utf8').split('\n');
    let inCode = false;
    for (let lnIdx = 0; lnIdx < lines.length; lnIdx++) {
      const line = lines[lnIdx];
      if (CODE_FENCE.test(line)) { inCode = !inCode; continue; }
      if (inCode) continue;
      const fix = findBoldPairs(line);
      if (fix.size) {
        const pairs = fix.size / 2;
        total += pairs;
        issues++;
        const [fixed] = applyFixes(line, fix);
        console.log(`${p}:${lnIdx + 1}  ${pairs} 处可能渲染失败:`);
        console.log(`   原文: ${line.trim().slice(0, 110)}`);
        console.log(`   建议: ${fixed.trim().slice(0, 110)}\n`);
      }
    }
  }

  if (issues) {
    console.log(`✗ 发现 ${total} 处可疑粗体（建议换成 <strong>...</strong>，共涉及 ${issues} 个文件/行）。`);
    process.exit(1);
  }
  console.log('✓ 未发现「闭合 ** 前标点、后非标点」的可疑粗体。');
}

main();
