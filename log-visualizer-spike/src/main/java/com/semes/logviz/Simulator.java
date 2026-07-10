package com.semes.logviz;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 더미 시뮬레이터 — VCS APP 각 모듈이 하는 일을 흉내내면서
 * 해당 모듈 명의의 로그를 LogBuffer에 발행한다.
 *
 * newAMOS Job 생성(HostInterface) → 유휴 AMR 할당(JobAssign)
 * → 경로 탐색(PathSearch/다익스트라) → 이동/작업 진행(Operation)
 * → 충전소 상태(UnitDevice). Job 1건 = 8 Task (VCS_PROJECT_OVERVIEW.md 2번).
 */
@Component
public class Simulator {

	private static final double TICK = 0.5;        // 시뮬레이션 틱(초)
	private static final double AMR_SPEED = 5.0;   // units/sec
	private static final int STATUS_EVERY = 2;     // AMR_STATUS 발행 주기 (틱 단위 → 1초)
	private static final double DWELL_SEC = 2.5;   // LOAD/UNLOAD 소요 시간

	private final LogBuffer logs;
	private final Random random = new Random();
	private final AtomicInteger jobNo = new AtomicInteger(113);
	private final AtomicInteger taskNo = new AtomicInteger(482);

	private final List<Amr> amrs = new ArrayList<>();
	private final List<Job> jobs = new ArrayList<>();
	private final Map<String, String> chargerBusy = new LinkedHashMap<>(); // chargerId -> amrId

	private long tick = 0;
	private double nextJobIn = 2.0;

	// ------------------------------------------------------------------
	// 엔티티
	// ------------------------------------------------------------------

	private static class Amr {
		final String id;
		String node;
		double x;
		double y;
		String state = "IDLE"; // IDLE / RUNNING / CHARGING
		double battery;
		Job job;
		Deque<String> path = new ArrayDeque<>();
		double dwell = 0;
		String charger;
		boolean goingToCharge = false;

		Amr(String id, String node, double battery) {
			this.id = id;
			this.node = node;
			this.x = MapData.NODES.get(node).x();
			this.y = MapData.NODES.get(node).y();
			this.battery = battery;
		}

		/** path를 따라 한 틱 이동. path 소진 시 true. */
		boolean stepMove() {
			double budget = AMR_SPEED * TICK;
			while (budget > 0 && !path.isEmpty()) {
				MapData.Node target = MapData.NODES.get(path.peekFirst());
				double d = Math.hypot(target.x() - x, target.y() - y);
				if (d <= budget) {
					x = target.x();
					y = target.y();
					node = path.pollFirst();
					budget -= d;
				} else {
					x += (target.x() - x) / d * budget;
					y += (target.y() - y) / d * budget;
					budget = 0;
				}
			}
			return path.isEmpty();
		}
	}

	private record TaskStep(int seq, String type, String dest) {}

	private class Job {
		final String id = "JOB-2026-%06d".formatted(jobNo.getAndIncrement());
		final String pcard = "PCARD-" + (1000 + random.nextInt(9000));
		final String source;  // Stocker
		final String target;  // Prober
		String status = "PENDING"; // PENDING / IN_PROGRESS / EDS_TESTING / COMPLETED
		Amr amr;
		int taskIdx = 0;
		final List<String> taskIds = new ArrayList<>();
		double edsWait = 0;

		Job(String source, String target) {
			this.source = source;
			this.target = target;
			for (int i = 0; i < 8; i++) {
				taskIds.add("TASK-2026-%06d".formatted(taskNo.getAndIncrement()));
			}
		}

		/** Job 1건 = 8 Task. origin은 실행 시점의 AMR 위치라 dest만 계획에 둔다. */
		List<TaskStep> plan() {
			return List.of(
					new TaskStep(1, "MOVE_TO_UNLOAD", source), new TaskStep(2, "UNLOAD", source),
					new TaskStep(3, "MOVE_TO_LOAD", target), new TaskStep(4, "LOAD", target),
					new TaskStep(5, "MOVE_TO_UNLOAD", target), new TaskStep(6, "UNLOAD", target),
					new TaskStep(7, "MOVE_TO_LOAD", source), new TaskStep(8, "LOAD", source));
		}
	}

	// ------------------------------------------------------------------

	public Simulator(LogBuffer logs) {
		this.logs = logs;
		amrs.add(new Amr("AMR-01", "N12", 88));
		amrs.add(new Amr("AMR-02", "N22", 72));
		amrs.add(new Amr("AMR-03", "N24", 95));
		amrs.add(new Amr("AMR-04", "N33", 34));
		amrs.add(new Amr("AMR-05", "N14", 61));
		chargerBusy.put("CHG-01", null);
		chargerBusy.put("CHG-02", null);

		logs.emit("MapUpdater", "MAP_UPDATED", Map.of(), Map.of(
				"mapVersion", MapData.MAP_VERSION, "changeType", "FULL_RELOAD",
				"changedNodeIds", List.of(), "triggeredBy", "system:startup"));
		logs.emit("ParameterManagement", "PARAM_CHANGED", Map.of(), Map.of(
				"paramKey", "AMR_MAX_SPEED", "oldValue", "1.0", "newValue", "0.8",
				"changedBy", "operator:kim"));
	}

	// ------------------------------------------------------------------
	// 시뮬레이션 루프
	// ------------------------------------------------------------------

	@Scheduled(fixedRate = 500)
	public synchronized void step() {
		tick++;

		// newAMOS Job 생성
		nextJobIn -= TICK;
		long active = jobs.stream().filter(j -> !"COMPLETED".equals(j.status)).count();
		if (nextJobIn <= 0 && active < 6) {
			spawnJob();
			nextJobIn = 8 + random.nextDouble() * 6;
		}
		tryAssign();

		for (Amr amr : amrs) {
			if ("CHARGING".equals(amr.state) || amr.goingToCharge) {
				stepCharging(amr);
			} else if (amr.job != null) {
				stepJob(amr);
			} else {
				maybeGoCharge(amr);
			}

			// 배터리 소모
			if ("RUNNING".equals(amr.state)) {
				amr.battery = Math.max(0, amr.battery - 0.12 * TICK);
			} else if ("IDLE".equals(amr.state)) {
				amr.battery = Math.max(0, amr.battery - 0.01 * TICK);
			}

			// 주기 상태 보고 (Operation ← AMR)
			if (tick % STATUS_EVERY == 0) {
				emitAmrStatus(amr);
			}
		}
	}

	private void stepJob(Amr amr) {
		Job job = amr.job;
		if ("EDS_TESTING".equals(job.status)) {
			job.edsWait -= TICK;
			if (job.edsWait <= 0) {
				job.status = "IN_PROGRESS";
				amr.state = "RUNNING";
				startTask(amr);
			}
		} else if (amr.dwell > 0) {
			amr.dwell -= TICK;
			if (amr.dwell <= 0) {
				finishTask(amr);
			}
		} else if (!amr.path.isEmpty()) {
			if (amr.stepMove()) {
				finishTask(amr);
			}
		} else {
			finishTask(amr); // 이동 거리 0인 MOVE task (5번 등)
		}
	}

	private void spawnJob() {
		String src = random.nextBoolean() ? "STK-01" : "STK-02";
		String dst = "PRB-0" + (1 + random.nextInt(4));
		Job job = new Job(src, dst);
		jobs.add(job);
		logs.emit("HostInterface", "JOB_RECEIVED", Map.of("jobId", job.id), Map.of(
				"sourceId", src, "targetId", dst,
				"pcardId", job.pcard, "requestedBy", "newAMOS"));
	}

	private void tryAssign() {
		List<Amr> idle = new ArrayList<>(amrs.stream()
				.filter(a -> "IDLE".equals(a.state) && a.job == null
						&& !a.goingToCharge && a.battery > 30)
				.toList());
		for (Job job : jobs) {
			if (!"PENDING".equals(job.status) || idle.isEmpty()) {
				continue;
			}
			idle.sort(Comparator.comparingDouble(a -> MapData.dist(a.node, job.source)));
			List<String> candidates = idle.stream().limit(3).map(a -> a.id).toList();
			Amr amr = idle.remove(0);
			job.amr = amr;
			job.status = "IN_PROGRESS";
			amr.job = job;
			logs.emit("JobAssign", "TASK_ASSIGNED",
					Map.of("jobId", job.id, "taskId", job.taskIds.get(0), "amrId", amr.id),
					Map.of("candidateAmrIds", candidates,
							"assignedAmrId", amr.id,
							"reason", "IDLE · 최근접(%.0fm) · 배터리 %.0f%%"
									.formatted(MapData.dist(amr.node, job.source), amr.battery)));
			logs.emit("HostInterface", "JOB_REPORTED",
					Map.of("jobId", job.id, "amrId", amr.id),
					Map.of("reportType", "IN_PROGRESS", "detail", amr.id + "에 할당됨"));
			startTask(amr);
		}
	}

	private void startTask(Amr amr) {
		Job job = amr.job;
		TaskStep step = job.plan().get(job.taskIdx);
		Map<String, Object> corr = Map.of(
				"jobId", job.id, "taskId", job.taskIds.get(job.taskIdx), "amrId", amr.id);
		logs.emit("Operation", "TASK_UPDATE", corr, Map.of(
				"taskSeq", step.seq(), "taskType", step.type(),
				"origin", amr.node, "destination", step.dest(), "status", "IN_PROGRESS"));
		if (step.type().startsWith("MOVE")) {
			MapData.PathResult result = MapData.dijkstra(amr.node, step.dest());
			logs.emit("PathSearch", "PATH_RESULT", corr, Map.of(
					"origin", amr.node, "destination", step.dest(),
					"algorithm", "DIJKSTRA", "path", result.path(),
					"distanceM", Math.round(result.distance() * 10) / 10.0,
					"estimatedTimeSec", Math.round(result.distance() / AMR_SPEED)));
			amr.path = new ArrayDeque<>(result.path().subList(1, result.path().size()));
			amr.state = "RUNNING";
		} else { // LOAD / UNLOAD — 제자리 작업
			amr.dwell = DWELL_SEC;
			amr.state = "RUNNING";
		}
	}

	private void finishTask(Amr amr) {
		Job job = amr.job;
		TaskStep step = job.plan().get(job.taskIdx);
		logs.emit("Operation", "TASK_UPDATE",
				Map.of("jobId", job.id, "taskId", job.taskIds.get(job.taskIdx), "amrId", amr.id),
				Map.of("taskSeq", step.seq(), "taskType", step.type(),
						"origin", amr.node, "destination", step.dest(), "status", "COMPLETED"));
		job.taskIdx++;
		if (job.taskIdx >= 8) {
			job.status = "COMPLETED";
			logs.emit("HostInterface", "JOB_REPORTED",
					Map.of("jobId", job.id, "amrId", amr.id),
					Map.of("reportType", "COMPLETED",
							"detail", "%s 반납 완료 (%s→%s→%s)"
									.formatted(job.pcard, job.source, job.target, job.source)));
			amr.job = null;
			amr.state = "IDLE";
		} else if (job.taskIdx == 4) { // LOAD(4) 완료 → EDS 테스트 대기
			job.status = "EDS_TESTING";
			job.edsWait = 8 + random.nextDouble() * 6;
			amr.state = "IDLE";
		} else {
			startTask(amr);
		}
	}

	private void stepCharging(Amr amr) {
		if (amr.goingToCharge) {
			if (amr.stepMove()) {
				amr.goingToCharge = false;
				amr.state = "CHARGING";
				emitChargerStatus(amr, "CHARGING", amr.id);
			}
			return;
		}
		amr.battery = Math.min(100, amr.battery + 0.9 * TICK);
		if (amr.battery >= 85) {
			emitChargerStatus(amr, "IDLE", null);
			chargerBusy.put(amr.charger, null);
			amr.charger = null;
			amr.state = "IDLE";
		}
	}

	private void maybeGoCharge(Amr amr) {
		if (amr.battery >= 30 || amr.job != null || amr.goingToCharge
				|| "CHARGING".equals(amr.state)) {
			return;
		}
		String charger = chargerBusy.entrySet().stream()
				.filter(e -> e.getValue() == null)
				.map(Map.Entry::getKey)
				.min(Comparator.comparingDouble(c -> MapData.dist(amr.node, c)))
				.orElse(null);
		if (charger == null) {
			return;
		}
		chargerBusy.put(charger, amr.id);
		amr.charger = charger;
		amr.goingToCharge = true;
		amr.state = "RUNNING";
		MapData.PathResult result = MapData.dijkstra(amr.node, charger);
		amr.path = new ArrayDeque<>(result.path().subList(1, result.path().size()));
	}

	private void emitChargerStatus(Amr amr, String state, String connectedAmrId) {
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("chargerId", amr.charger);
		payload.put("state", state);
		payload.put("connectedAmrId", connectedAmrId);
		payload.put("batteryLevel", Math.round(amr.battery * 10) / 10.0);
		logs.emit("UnitDevice", "CHARGER_STATUS", Map.of("amrId", amr.id), payload);
	}

	private void emitAmrStatus(Amr amr) {
		Map<String, Object> corr = new LinkedHashMap<>();
		corr.put("amrId", amr.id);
		if (amr.job != null && amr.job.taskIdx < 8) {
			corr.put("taskId", amr.job.taskIds.get(amr.job.taskIdx));
		}
		logs.emit("Operation", "AMR_STATUS", corr, Map.of(
				"position", Map.of(
						"x", Math.round(amr.x * 10) / 10.0,
						"y", Math.round(amr.y * 10) / 10.0,
						"nodeId", amr.node),
				"state", amr.state,
				"battery", Math.round(amr.battery * 10) / 10.0));
	}
}
