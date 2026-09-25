package com.semes.reqops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ReqopsApplication {
    public static void main(String[] args) {
        SpringApplication.run(ReqopsApplication.class, args);
    }
}
