package com.semes.reqops.domain.requirement.controller;
import com.semes.reqops.domain.requirement.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
@RestController @RequiredArgsConstructor @RequestMapping("/api/projects/{projectId}/requirements/{requirementId}/attachments")
public class AttachmentController {private final AttachmentService service;@PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public AttachmentService.Response upload(@PathVariable Long projectId,@PathVariable Long requirementId,@RequestParam Long userId,@RequestPart("file") MultipartFile file){return service.upload(projectId,requirementId,userId,file);}@GetMapping public List<AttachmentService.Response> list(@PathVariable Long projectId,@PathVariable Long requirementId,@RequestParam Long userId){return service.list(projectId,requirementId,userId);}}
