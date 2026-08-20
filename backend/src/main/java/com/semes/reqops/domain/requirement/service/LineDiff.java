package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.requirement.dto.RequirementDto.DiffRow;

import java.util.ArrayList;
import java.util.List;

/**
 * 줄 단위 diff. 화면 6의 split 뷰가 좌우 줄을 나란히 보여줘야 해서,
 * 결과를 <b>정렬된 행</b>(왼쪽 줄 · 오른쪽 줄 쌍)으로 만들어 준다.
 *
 * <p>LCS(최장 공통 부분수열)로 공통 줄을 찾고, 그 사이의 삭제/추가를 짝지어
 * 한 행으로 묶는다. 짝이 안 맞는 쪽은 빈 칸으로 채워 좌우 줄 번호가 어긋나지 않게 한다.
 *
 * <p>라이브러리를 쓰지 않은 이유: 폐쇄망에 반입할 의존성을 하나라도 줄이려는 것.
 * 요구사항 본문은 길어야 수십 줄이라 O(n·m) 로도 충분하다.
 */
final class LineDiff {

    private LineDiff() {
    }

    /** 문단을 줄로 나눈다. 빈 본문도 최소 한 줄로 취급해 화면이 비지 않게 한다. */
    private static List<String> lines(String text) {
        String t = text == null ? "" : text;
        return List.of(t.split("\n", -1));
    }

    static List<DiffRow> rows(String baseText, String headText) {
        List<String> a = lines(baseText);
        List<String> b = lines(headText);

        // lcs[i][j] = a[i..], b[j..] 의 최장 공통 줄 수
        int[][] lcs = new int[a.size() + 1][b.size() + 1];
        for (int i = a.size() - 1; i >= 0; i--) {
            for (int j = b.size() - 1; j >= 0; j--) {
                lcs[i][j] = a.get(i).equals(b.get(j))
                        ? lcs[i + 1][j + 1] + 1
                        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }

        List<DiffRow> rows = new ArrayList<>();
        int i = 0, j = 0;
        while (i < a.size() && j < b.size()) {
            if (a.get(i).equals(b.get(j))) {
                rows.add(new DiffRow("ctx", i + 1, a.get(i), j + 1, b.get(j)));
                i++;
                j++;
            } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
                rows.add(new DiffRow("del", i + 1, a.get(i), null, null));
                i++;
            } else {
                rows.add(new DiffRow("add", null, null, j + 1, b.get(j)));
                j++;
            }
        }
        while (i < a.size()) {
            rows.add(new DiffRow("del", i + 1, a.get(i), null, null));
            i++;
        }
        while (j < b.size()) {
            rows.add(new DiffRow("add", null, null, j + 1, b.get(j)));
            j++;
        }

        return pairUp(rows);
    }

    /**
     * 연속된 삭제·추가를 한 행으로 짝지어 split 뷰에서 좌우로 마주 보게 만든다.
     *
     * <p>짝지어 두지 않으면 "3줄 삭제 후 3줄 추가"가 화면에서 위아래로 흩어져,
     * 무엇이 무엇으로 바뀐 건지 눈으로 따라가기 어렵다.
     */
    private static List<DiffRow> pairUp(List<DiffRow> rows) {
        List<DiffRow> out = new ArrayList<>();
        int k = 0;
        while (k < rows.size()) {
            if (!"del".equals(rows.get(k).type())) {
                out.add(rows.get(k));
                k++;
                continue;
            }
            // 연속된 삭제 묶음과, 바로 뒤에 붙은 추가 묶음을 모은다.
            List<DiffRow> dels = new ArrayList<>();
            while (k < rows.size() && "del".equals(rows.get(k).type())) {
                dels.add(rows.get(k));
                k++;
            }
            List<DiffRow> adds = new ArrayList<>();
            while (k < rows.size() && "add".equals(rows.get(k).type())) {
                adds.add(rows.get(k));
                k++;
            }

            int n = Math.max(dels.size(), adds.size());
            for (int x = 0; x < n; x++) {
                DiffRow d = x < dels.size() ? dels.get(x) : null;
                DiffRow p = x < adds.size() ? adds.get(x) : null;
                String type = d != null && p != null ? "change" : (d != null ? "del" : "add");
                out.add(new DiffRow(
                        type,
                        d == null ? null : d.baseNo(), d == null ? null : d.baseText(),
                        p == null ? null : p.headNo(), p == null ? null : p.headText()));
            }
        }
        return out;
    }
}
