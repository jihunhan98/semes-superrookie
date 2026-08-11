package com.semes.reqops.domain.user.repository;

import com.semes.reqops.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByEmpNo(String empNo);
    Optional<User> findByEmpNo(String empNo);
}
