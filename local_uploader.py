#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ELAND 의류CU 주간 실적 업로더
==============================
SAP BI 원본 Excel 파일을 읽어 업로드용 JSON 파일로 변환합니다.

사전 준비:
  pip install pywin32

사용법:
  python local_uploader.py                          <- 파일 선택 다이얼로그
  python local_uploader.py "파일경로.xlsx"           <- 직접 경로 지정
  python local_uploader.py "파일경로.xlsx" --out     <- JSON 파일로 저장만 (업로드 없이)

출력:
  output_YYYYMMDD_HHMMSS.json  <- 대시보드에 업로드할 JSON 파일
"""

import sys
import os
import re
import json
import argparse
from datetime import datetime

# ──────────────────────────────────────────────
#  열 인덱스 (0-based, 올해 RAW 시트 기준)
#  헤더는 5행(Excel), 데이터는 6행부터 시작
# ──────────────────────────────────────────────
COL_STYLE_CODE       = 0   # A: 스타일코드
COL_SEASON           = 1   # B: 시즌
COL_CD               = 2   # C: CD
COL_CELL             = 3   # D: 셀
COL_BRAND            = 4   # E: 브랜드
COL_MONTH            = 5   # F: 월
COL_CATEGORY_L       = 6   # G: 대분류
COL_CATEGORY_M       = 7   # H: 중분류
COL_CATEGORY_S       = 8   # I: 소분류
COL_PRODUCT_NAME     = 17  # R: 상품명
COL_ORIGINAL_PRICE   = 18  # S: 최초판매가
COL_CURRENT_PRICE    = 19  # T: 현재판매가

COL_CUM_RECEIPT_AMT  = 28  # AC: 누적입고액(최초판매가)
COL_PERIOD_RECEIPT_AMT = 30 # AE: 기간입고액(최초판매가)
COL_PERIOD_SALE_QTY  = 31  # AF: 기간판매량
COL_PERIOD_SALE_AMT  = 32  # AG: 기간총매출액
COL_PERIOD_SALE_RATE = 34  # AI: 기간판매율
COL_CUM_SALE_QTY     = 38  # AM: 누적판매량
COL_CUM_SALE_AMT     = 39  # AN: 누적총매출액
COL_CUM_SALE_RATE    = 41  # AP: 누적판매율
COL_CUM_JUNGPAN_RATE = 44  # AS: 누적입고대비정판율
COL_PERIOD_COST_AMT  = 53  # BB: 기간총매출원가
COL_PERIOD_MARGIN_RATE = 54 # BC: 기간매출총이익율
COL_CUM_COST_AMT     = 55  # BD: 누적총매출원가
COL_CUM_MARGIN_RATE  = 56  # BE: 누적매출총이익율

# 셀매칭 열 인덱스 (0-based)
CM_STYLE_CODE  = 2   # C: 스타일넘버
CM_PRODUCT_NAME = 3  # D: 상품명
CM_CD          = 5   # F: CD
CM_CELL        = 6   # G: 셀
CM_BRAND       = 7   # H: 브랜드
CM_CATEGORY_L  = 8   # I: 대분류
CM_CATEGORY_M  = 9   # J: 중분류
CM_CATEGORY_S  = 10  # K: 소분류


# ──────────────────────────────────────────────
#  유틸리티
# ──────────────────────────────────────────────
def safe_num(v):
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def safe_str(v):
    if v is None:
        return ''
    s = str(v).strip()
    return '' if s.lower() == 'none' else s


def col(row_tuple, idx):
    """row_tuple에서 0-based 인덱스로 값 추출"""
    try:
        return row_tuple[idx]
    except IndexError:
        return None


# ──────────────────────────────────────────────
#  주차 정보 파싱
# ──────────────────────────────────────────────
def parse_week_info(all_values):
    """
    올해 시트 2행(index 1)에서 주차 정보 추출
    형태: "2026-02-23 - 2026-03-01"
    """
    if len(all_values) < 2:
        return _default_week()

    row2 = all_values[1]  # 2행 (0-based index 1)
    # 11번째 셀(index 10)에 날짜 범위
    val = safe_str(col(row2, 10))

    m = re.match(r'(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})', val)
    if m:
        week_start = m.group(1)
        week_end   = m.group(2)
        dt = datetime.strptime(week_start, '%Y-%m-%d')
        iso_week = dt.isocalendar()[1]
        label = f"{dt.year}-W{iso_week:02d} ({week_start[5:]}~{week_end[5:]})"
        return {'week_label': label, 'week_start': week_start, 'week_end': week_end}

    return _default_week()


def _default_week():
    from datetime import date
    today = date.today()
    w = today.isocalendar()[1]
    s = str(today)
    return {'week_label': f"{today.year}-W{w:02d}", 'week_start': s, 'week_end': s}


# ──────────────────────────────────────────────
#  셀매칭 읽기
# ──────────────────────────────────────────────
def read_cell_matching(wb):
    """26년셀매칭(또는 25년셀매칭) 시트에서 스타일코드 → 분류 매핑 구축"""
    ws = None
    for name in ['26년셀매칭', '25년셀매칭']:
        try:
            ws = wb.Sheets(name)
            break
        except Exception:
            pass

    if ws is None:
        print("  ⚠  셀매칭 시트를 찾을 수 없습니다. RAW 데이터 분류를 그대로 사용합니다.")
        return {}

    all_values = ws.UsedRange.Value  # tuple of tuples
    mapping = {}

    for row_tuple in all_values[2:]:  # 3행(index 2)부터 데이터
        style = safe_str(col(row_tuple, CM_STYLE_CODE))
        if not style:
            continue
        mapping[style] = {
            'product_name': safe_str(col(row_tuple, CM_PRODUCT_NAME)),
            'cd':           safe_str(col(row_tuple, CM_CD)),
            'cell_type':    safe_str(col(row_tuple, CM_CELL)),
            'brand':        safe_str(col(row_tuple, CM_BRAND)),
            'category_l':   safe_str(col(row_tuple, CM_CATEGORY_L)),
            'category_m':   safe_str(col(row_tuple, CM_CATEGORY_M)),
            'category_s':   safe_str(col(row_tuple, CM_CATEGORY_S)),
        }

    print(f"  ✓ 셀매칭 {len(mapping):,}개 스타일 로드")
    return mapping


# ──────────────────────────────────────────────
#  올해 RAW 시트 읽기
# ──────────────────────────────────────────────
def read_raw_sheet(wb, cell_match):
    ws = wb.Sheets('올해')
    print("  올해 시트 전체 데이터 읽는 중 (수초 소요)...")
    all_values = ws.UsedRange.Value  # tuple of tuples

    week_info = parse_week_info(all_values)
    print(f"  ✓ 주차 정보: {week_info['week_label']}  ({week_info['week_start']} ~ {week_info['week_end']})")

    rows = []
    skipped = 0

    # 데이터는 6행(index 5)부터
    for row_tuple in all_values[5:]:
        style_code = safe_str(col(row_tuple, COL_STYLE_CODE))
        if not style_code:
            skipped += 1
            continue

        # 누적판매·입고가 모두 0인 행은 제외 (의미없는 데이터)
        cum_sale_amt    = safe_num(col(row_tuple, COL_CUM_SALE_AMT))
        cum_receipt_amt = safe_num(col(row_tuple, COL_CUM_RECEIPT_AMT))
        if cum_sale_amt == 0 and cum_receipt_amt == 0:
            skipped += 1
            continue

        # 셀매칭 우선, 없으면 RAW 값 사용
        cm = cell_match.get(style_code, {})

        brand      = safe_str(col(row_tuple, COL_BRAND))      or cm.get('brand', '미분류')
        product_nm = safe_str(col(row_tuple, COL_PRODUCT_NAME)) or cm.get('product_name', '')
        category_l = safe_str(col(row_tuple, COL_CATEGORY_L)) or cm.get('category_l', '')
        category_m = safe_str(col(row_tuple, COL_CATEGORY_M)) or cm.get('category_m', '')
        category_s = safe_str(col(row_tuple, COL_CATEGORY_S)) or cm.get('category_s', '')
        cd         = safe_str(col(row_tuple, COL_CD))         or cm.get('cd', '')
        cell_type  = safe_str(col(row_tuple, COL_CELL))       or cm.get('cell_type', '')

        rows.append({
            'week_label':          week_info['week_label'],
            'style_code':          style_code,
            'product_name':        product_nm,
            'season':              safe_str(col(row_tuple, COL_SEASON)),
            'cd':                  cd,
            'cell_type':           cell_type,
            'brand':               brand or '미분류',
            'month':               int(safe_num(col(row_tuple, COL_MONTH))),
            'category_l':          category_l,
            'category_m':          category_m,
            'category_s':          category_s,
            'original_price':      safe_num(col(row_tuple, COL_ORIGINAL_PRICE)),
            'current_price':       safe_num(col(row_tuple, COL_CURRENT_PRICE)),
            # 기간
            'period_sale_qty':     safe_num(col(row_tuple, COL_PERIOD_SALE_QTY)),
            'period_sale_amt':     safe_num(col(row_tuple, COL_PERIOD_SALE_AMT)),
            'period_receipt_amt':  safe_num(col(row_tuple, COL_PERIOD_RECEIPT_AMT)),
            'period_cost_amt':     safe_num(col(row_tuple, COL_PERIOD_COST_AMT)),
            'period_margin_rate':  safe_num(col(row_tuple, COL_PERIOD_MARGIN_RATE)),
            # 누적
            'cum_sale_qty':        safe_num(col(row_tuple, COL_CUM_SALE_QTY)),
            'cum_sale_amt':        cum_sale_amt,
            'cum_receipt_amt':     cum_receipt_amt,
            'cum_cost_amt':        safe_num(col(row_tuple, COL_CUM_COST_AMT)),
            'cum_margin_rate':     safe_num(col(row_tuple, COL_CUM_MARGIN_RATE)),
            'cum_sale_rate':       safe_num(col(row_tuple, COL_CUM_SALE_RATE)),
            'cum_jungpan_rate':    safe_num(col(row_tuple, COL_CUM_JUNGPAN_RATE)),
        })

    print(f"  ✓ {len(rows):,}개 스타일 파싱 완료  (제외: {skipped:,}행)")
    return week_info, rows


# ──────────────────────────────────────────────
#  JSON 저장
# ──────────────────────────────────────────────
def save_json(week_info, rows, out_path=None):
    if out_path is None:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'upload_{ts}.json')

    payload = {
        'week_info': week_info,
        'rows':      rows,
    }
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"\n  ✓ JSON 저장 완료: {out_path}")
    print(f"     파일 크기: {size_kb:,.0f} KB")
    return out_path


# ──────────────────────────────────────────────
#  파일 선택 (tkinter)
# ──────────────────────────────────────────────
def choose_file():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', True)
        path = filedialog.askopenfilename(
            title='의류CU 주간 실적 파일 선택',
            filetypes=[('Excel 파일', '*.xlsx *.xlsm *.xls'), ('모든 파일', '*.*')],
        )
        root.destroy()
        return path or None
    except Exception:
        return None


# ──────────────────────────────────────────────
#  메인
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='의류CU 실적 데이터 → JSON 변환기')
    parser.add_argument('file', nargs='?', help='Excel 파일 경로 (생략 시 파일 선택 창)')
    parser.add_argument('--out', help='출력 JSON 파일 경로 (기본: upload_YYYYMMDD.json)')
    args = parser.parse_args()

    # 파일 경로 결정
    file_path = args.file
    if not file_path:
        print("파일 선택 창을 열고 있습니다...")
        file_path = choose_file()
    if not file_path:
        print("파일이 선택되지 않았습니다. 종료합니다.")
        sys.exit(0)
    if not os.path.exists(file_path):
        print(f"오류: 파일을 찾을 수 없습니다 → {file_path}")
        sys.exit(1)

    print(f"\n{'='*55}")
    print(f" ELAND CU 주간 실적 업로드 변환기")
    print(f"{'='*55}")
    print(f"파일: {os.path.basename(file_path)}\n")

    # pywin32 임포트 확인
    try:
        import win32com.client
    except ImportError:
        print("오류: pywin32가 설치되어 있지 않습니다.")
        print("  pip install pywin32  을 실행한 후 다시 시도하세요.")
        sys.exit(1)

    # Excel COM 으로 파일 열기
    print("[1/3] Excel 파일 열는 중...")
    xl = win32com.client.Dispatch('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False

    try:
        wb = xl.Workbooks.Open(file_path, UpdateLinks=0, ReadOnly=True)

        print("[2/3] 셀매칭 시트 읽는 중...")
        cell_match = read_cell_matching(wb)

        print("[3/3] 올해 RAW 시트 읽는 중...")
        week_info, rows = read_raw_sheet(wb, cell_match)

        wb.Close(False)
    finally:
        xl.Quit()

    # JSON 저장
    out_path = save_json(week_info, rows, args.out)

    print(f"\n{'='*55}")
    print(f" 완료!")
    print(f"{'='*55}")
    print(f" 주차  : {week_info['week_label']}")
    print(f" 기간  : {week_info['week_start']} ~ {week_info['week_end']}")
    print(f" 스타일: {len(rows):,}개")
    print(f"\n 다음 단계:")
    print(f"  1. 대시보드(https://eland-seven.vercel.app) 접속")
    print(f"  2. 우측 상단 [파일 업로드] 클릭")
    print(f"  3. 아래 JSON 파일 업로드:")
    print(f"     {out_path}")
    print(f"{'='*55}\n")


if __name__ == '__main__':
    main()
