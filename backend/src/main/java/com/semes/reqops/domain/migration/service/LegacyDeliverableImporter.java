package com.semes.reqops.domain.migration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSetMetaData;
import java.util.*;

@Service @RequiredArgsConstructor
public class LegacyDeliverableImporter {
    private static final List<String> TABLES=List.of("DEVELOPMENT_ISSUES","SWVOCS","FUNCTIONAL_REQUIREMENTS","NON_FUNCTIONAL_REQUIREMENTS","REQUIREMENT_SCENARIOS","DETAIL_DESIGNS");
    private final JdbcTemplate jdbc; private final ObjectMapper mapper;
    @Transactional public Map<String,Integer> snapshot(){Map<String,Integer> counts=new LinkedHashMap<>();for(String table:TABLES){if(!exists(table)){counts.put(table,0);continue;}List<Map<String,Object>> rows=jdbc.query("select * from "+table,rs->{List<Map<String,Object>> out=new ArrayList<>();ResultSetMetaData md=rs.getMetaData();while(rs.next()){Map<String,Object> row=new LinkedHashMap<>();for(int i=1;i<=md.getColumnCount();i++)row.put(md.getColumnLabel(i),rs.getObject(i));out.add(row);}return out;});for(Map<String,Object> row:rows){String pk=String.valueOf(row.getOrDefault("ID","UNKNOWN"));try{String json=mapper.writeValueAsString(row);jdbc.update("merge into legacy_snapshots t using (select ? source_table, ? source_pk from dual) s on (t.source_table=s.source_table and t.source_pk=s.source_pk) when not matched then insert(source_table,source_pk,payload_json,payload_hash) values(?,?,?,?)",table,pk,table,pk,json,sha(json));}catch(Exception e){throw new IllegalStateException("legacy snapshot failed: "+table+"/"+pk,e);}}counts.put(table,rows.size());}return counts;}
    public boolean exists(String table){Integer n=jdbc.queryForObject("select count(*) from user_tables where table_name=?",Integer.class,table);return n!=null&&n>0;}
    private String sha(String s){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
