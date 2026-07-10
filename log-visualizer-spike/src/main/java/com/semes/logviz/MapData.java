package com.semes.logviz;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * 맵 정의 — 노드(waypoint / Stocker / Prober / ChargeStation) + 양방향 링크.
 * 실제로는 .dat 맵 파일을 파싱해서 만들 부분 (MapLoader 대체).
 * PathSearch 모듈의 다익스트라 경로 탐색도 여기서 대신 수행.
 */
public final class MapData {

	public static final String MAP_VERSION = "v1.4.2";

	public record Node(String id, String type, double x, double y) {}

	public record Link(String from, String to) {}

	public record PathResult(List<String> path, double distance) {}

	public static final Map<String, Node> NODES = new LinkedHashMap<>();
	public static final List<Link> LINKS = new ArrayList<>();
	private static final Map<String, List<Map.Entry<String, Double>>> ADJ = new HashMap<>();

	static {
		// waypoint 격자: 3행(y=10,20,30) x 5열(x=10..50)
		int[] ys = {10, 20, 30};
		int[] xs = {10, 20, 30, 40, 50};
		for (int r = 1; r <= 3; r++) {
			for (int c = 1; c <= 5; c++) {
				node("N" + r + c, "WAYPOINT", xs[c - 1], ys[r - 1]);
			}
		}
		node("STK-01", "STOCKER", 2, 10);
		node("STK-02", "STOCKER", 2, 30);
		node("PRB-01", "PROBER", 58, 10);
		node("PRB-02", "PROBER", 58, 20);
		node("PRB-03", "PROBER", 58, 30);
		node("PRB-04", "PROBER", 30, 2);
		node("CHG-01", "CHARGE_STATION", 20, 38);
		node("CHG-02", "CHARGE_STATION", 40, 38);

		// 행 방향 링크
		for (int r = 1; r <= 3; r++) {
			for (int c = 1; c <= 4; c++) {
				link("N" + r + c, "N" + r + (c + 1));
			}
		}
		// 열 방향 링크는 1/3/5열에만 (경로 탐색이 좀 더 유의미해지도록)
		for (int c : new int[] {1, 3, 5}) {
			link("N1" + c, "N2" + c);
			link("N2" + c, "N3" + c);
		}
		// 설비 접속 링크
		link("STK-01", "N11");
		link("STK-02", "N31");
		link("PRB-01", "N15");
		link("PRB-02", "N25");
		link("PRB-03", "N35");
		link("PRB-04", "N13");
		link("CHG-01", "N32");
		link("CHG-02", "N34");
	}

	private MapData() {}

	private static void node(String id, String type, double x, double y) {
		NODES.put(id, new Node(id, type, x, y));
		ADJ.put(id, new ArrayList<>());
	}

	private static void link(String a, String b) {
		LINKS.add(new Link(a, b));
		double d = dist(a, b);
		ADJ.get(a).add(Map.entry(b, d));
		ADJ.get(b).add(Map.entry(a, d));
	}

	public static double dist(String a, String b) {
		Node na = NODES.get(a);
		Node nb = NODES.get(b);
		return Math.hypot(na.x() - nb.x(), na.y() - nb.y());
	}

	/** PathSearch 모듈 대체 — 최단 경로 노드 리스트와 거리 반환. */
	public static PathResult dijkstra(String src, String dst) {
		record Entry(double cost, String node, List<String> path) {}
		PriorityQueue<Entry> pq = new PriorityQueue<>((a, b) -> Double.compare(a.cost(), b.cost()));
		pq.add(new Entry(0.0, src, List.of(src)));
		Set<String> seen = new HashSet<>();
		while (!pq.isEmpty()) {
			Entry cur = pq.poll();
			if (cur.node().equals(dst)) {
				return new PathResult(cur.path(), cur.cost());
			}
			if (!seen.add(cur.node())) {
				continue;
			}
			for (Map.Entry<String, Double> next : ADJ.get(cur.node())) {
				if (!seen.contains(next.getKey())) {
					List<String> path = new ArrayList<>(cur.path());
					path.add(next.getKey());
					pq.add(new Entry(cur.cost() + next.getValue(), next.getKey(), path));
				}
			}
		}
		return new PathResult(List.of(src), 0.0);
	}
}
