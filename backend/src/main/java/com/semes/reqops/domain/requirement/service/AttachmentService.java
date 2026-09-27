package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.entity.RequirementAttachment;
import com.semes.reqops.domain.requirement.repository.RequirementAttachmentRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@Service @RequiredArgsConstructor
public class AttachmentService {
    private final RequirementAttachmentRepository attachments; private final RequirementRepository requirements; private final MembershipRepository memberships; private final AttachmentExtractionService extraction;
    public record Response(Long id,String fileName,String mediaType,long fileSize,String extractionState,String extractedText,String createdAt){}
    @Transactional public Response upload(Long projectId,Long requirementId,Long userId,MultipartFile file){authorize(projectId,requirementId,userId);if(file.isEmpty())throw new ApiErrors.BadRequest("빈 파일은 첨부할 수 없습니다.");if(file.getSize()>AttachmentExtractionService.MAX_BYTES)throw new ApiErrors.PayloadTooLarge("첨부 파일은 10MB 이하여야 합니다.");try{byte[] bytes=file.getBytes();String media=file.getContentType()==null?"application/octet-stream":file.getContentType();AttachmentExtractionService.Extracted result=extraction.extract(media,file.getOriginalFilename(),bytes);RequirementAttachment saved=attachments.save(new RequirementAttachment(requirementId,safeName(file.getOriginalFilename()),media,bytes,result.text(),result.state(),userId));return response(saved);}catch(ApiErrors.PayloadTooLarge e){throw e;}catch(Exception e){throw new ApiErrors.BadRequest("첨부 파일을 읽을 수 없습니다: "+e.getMessage());}}
    @Transactional(readOnly=true) public List<Response> list(Long projectId,Long requirementId,Long userId){authorize(projectId,requirementId,userId);return attachments.findByRequirementIdOrderByIdAsc(requirementId).stream().map(this::response).toList();}
    private void authorize(Long projectId,Long requirementId,Long userId){memberships.findByUserIdAndProjectId(userId,projectId).orElseThrow(ApiErrors.NotProjectMember::new);requirements.findById(requirementId).filter(r->r.getProjectId().equals(projectId)).orElseThrow(()->new ApiErrors.RequirementNotFound(requirementId));}
    private String safeName(String value){String name=value==null?"attachment":value.replace('\\','/');int slash=name.lastIndexOf('/');return (slash>=0?name.substring(slash+1):name).substring(0,Math.min(255,(slash>=0?name.substring(slash+1):name).length()));}
    private Response response(RequirementAttachment a){return new Response(a.getId(),a.getFileName(),a.getMediaType(),a.getFileSize(),a.getExtractionState(),a.getExtractedText(),a.getCreatedAt()==null?null:a.getCreatedAt().toString());}
}
