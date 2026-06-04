# reviewhub-api-platform
Centralized review hub and API platform for partners to submit, moderate, analyze, and consume reviews across multiple service domains.
PS C:\Windows\system32> Invoke-RestMethod `
>>   -Uri "http://localhost:8080/api/ai/advisor" `
>>   -Method POST `
>>   -ContentType "application/json" `
>>   -Body '{"message":"hello"}'


id                     : resp_0ef984a70a166a85006a02575bfde48195b12727453b96c9e9
object                 : response
created_at             : 1778538332
status                 : completed
background             : False
billing                : @{payer=developer}
completed_at           : 1778538334
error                  :
frequency_penalty      : 0.0
incomplete_details     :
instructions           :
max_output_tokens      :
max_tool_calls         :
model                  : gpt-4o-mini-2024-07-18
moderation             :
output                 : {@{id=msg_0ef984a70a166a85006a02575de3c881959339cb7f1d7f262f; type=message; status=completed;
                         content=System.Object[]; role=assistant}}
parallel_tool_calls    : True
presence_penalty       : 0.0
previous_response_id   :
prompt_cache_key       :
prompt_cache_retention : in_memory
reasoning              : @{effort=; summary=}
safety_identifier      :
service_tier           : default
store                  : True
temperature            : 1.0
text                   : @{format=; verbosity=medium}
tool_choice            : auto
tools                  : {}
top_logprobs           : 0
top_p                  : 1.0
truncation             : disabled
usage                  : @{input_tokens=516; input_tokens_details=; output_tokens=17; output_tokens_details=;
                         total_tokens=533}
user                   :
metadata               :



PS C:\Windows\system32>

test xem lỗi backend ko bên power :
Invoke-RestMethod `
  -Uri "http://localhost:8080/api/ai/advisor" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"message":"hello"}'
  

- admin@reviewhub.vn / 123456
- partner@reviewhub.vn / 123456
- futa@reviewhub.vn / 123456
- anvui@reviewhub.vn / 123456
phuongtrang@reviewhub.vn/ 123456
thanhbuoi@reviewhub.vn/ 123456
hungcuong@reviewhub.vn/ 123456
Xe Minh Quân
minhquan@reviewhub.vn/ 123456

Đức Dương
ducduong@reviewhub.vn/ 123456

Kumho Samco
kumhosamco@reviewhub.vn/ 123456

'PT-013', name: 'Sao Việt
saoviet@reviewhub.vn/ 123456
chạy backend:


'PT-009', name: 'Cúc Tùng'
cuctung@reviewhub.vn/ 123456

PT-040', name: 'Như Vinh'
nhuvinh@reviewhub.vn/ 123456

{ code: 'KS-001', name: 'Mường Thanh Luxury Đà Nẵng', region: 'Đà Nẵng', type: 'Khách sạn 5 sao', hotline: '1900 1833', website: 'muongthanh.com', description: 'Khách sạn cao cấp tại Đà Nẵng, phù hợp nghỉ dưỡng, công tác và du lịch gia đình.' },
  { code: 'KS-002', name: 'Vinpearl Resort Nha Trang', region: 'Nha Trang', type: 'Resort / Khách sạn nghỉ dưỡng', hotline: '1900 6677', website: 'vinpearl.com', description: 'Khu nghỉ dưỡng cao cấp tại Nha Trang với nhiều tiện ích, phù hợp gia đình và khách du lịch.' },
  { code: 'KS-003', name: 'FLC Grand Hotel Hạ Long', region: 'Hạ Long', type: 'Khách sạn nghỉ dưỡng', hotline: '1900 5454', website: 'flchotelsresorts.com', description: 'Khách sạn nghỉ dưỡng view biển, phù hợp hội nghị, du lịch gia đình và nghỉ dưỡng cuối tuần.' },
  { code: 'KS-004', name: 'InterContinental Hanoi Westlake', region: 'Hà Nội', type: 'Khách sạn 5 sao', hotline: '024 6270 8888', website: 'ihg.com', description: 'Khách sạn cao cấp tại khu vực Hồ Tây, nổi bật với không gian sang trọng và dịch vụ chuyên nghiệp.' },
  { code: 'KS-005', name: 'Hotel Nikko Saigon', region: 'TP. Hồ Chí Minh', type: 'Khách sạn 5 sao', hotline: '028 3925 7777', website: 'hotelnikkosaigon.com.vn', description: 'Khách sạn trung tâm TP. Hồ Chí Minh, phù hợp công tác, du lịch và hội nghị.' },
  { code: 'KS-006', name: 'Saigon Morin Hotel Huế', region: 'Huế', type: 'Khách sạn di sản', hotline: '0234 3823 526', website: 'morinhotel.com.vn', description: 'Khách sạn lâu đời tại Huế, nổi bật với kiến trúc cổ điển và vị trí thuận tiện.' },
  { code: 'KS-007', name: 'Pullman Danang Beach Resort', region: 'Đà Nẵng', type: 'Resort biển', hotline: '0236 395 8888', website: 'pullman-danang.com', description: 'Resort biển cao cấp, phù hợp nghỉ dưỡng gia đình, cặp đôi và khách quốc tế.' },
  { code: 'KS-008', name: 'Lotte Hotel Saigon', region: 'TP. Hồ Chí Minh', type: 'Khách sạn 5 sao', hotline: '028 3823 3333', website: 'lottehotel.com', description: 'Khách sạn trung tâm thành phố, nổi bật với dịch vụ chuyên nghiệp và vị trí thuận tiện.' },
  { code: 'KS-009', name: 'Sapa Jade Hill Resort', region: 'Sa Pa', type: 'Resort nghỉ dưỡng', hotline: '0214 3888 888', website: 'sapajadehill.com', description: 'Khu nghỉ dưỡng tại Sa Pa, phù hợp du lịch thiên nhiên, nghỉ dưỡng và trải nghiệm văn hóa.' },
  { code: 'KS-010', name: 'Dalat Palace Heritage Hotel', region: 'Đà Lạt', type: 'Khách sạn di sản', hotline: '0263 3825 444', website: 'dalatpalace.vn', description: 'Khách sạn phong cách cổ điển tại Đà Lạt, nổi bật với không gian sang trọng và lịch sử lâu đời.' },
  { code: 'KS-011', name: 'Novotel Phu Quoc Resort', region: 'Phú Quốc', type: 'Resort biển', hotline: '0297 6260 999', website: 'novotelphuquoc.com', description: 'Resort biển tại Phú Quốc, phù hợp nghỉ dưỡng gia đình và du lịch dài ngày.' },
  { code: 'KS-012', name: 'Melia Ba Vi Mountain Retreat', region: 'Ba Vì', type: 'Resort núi', hotline: '024 3200 9999', website: 'melia.com', description: 'Khu nghỉ dưỡng trên núi, phù hợp nghỉ dưỡng cuối tuần, thiên nhiên và trải nghiệm yên tĩnh.' },
  
code: 'KS-001', name: 'Mường Thanh Luxury Đà Nẵng',
muongthanh@reviewhub.vn/ 123456

KS-002', name: 'Vinpearl Resort Nha Trang
vinpearlresort@reviewhub.vn/ 123456

code: 'KS-003', name: 'FLC Grand Hotel Hạ Long'
halong@reviewhub.vn/ 123456


cd C:\Users\Admin\Downloads\reviewhub-api-platform-main\reviewhub-api-platform-main\backend\reviewhub
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
.\mvnw.cmd clean spring-boot:run

chạy frontend:
npm run dev