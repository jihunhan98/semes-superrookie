package com.semes.reqops.domain.workflow.repository;

import com.semes.reqops.domain.workflow.entity.CommandReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CommandReceiptRepository extends JpaRepository<CommandReceipt, Long> {
    Optional<CommandReceipt> findByProjectIdAndCommandKey(Long projectId, String commandKey);
}
