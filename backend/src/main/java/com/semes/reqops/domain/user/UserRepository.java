package com.semes.reqops.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByEmpNo(String empNo);
    Optional<User> findByEmpNo(String empNo);
}
