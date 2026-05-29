const loginView = document.querySelector('#loginView');
const dashboardView = document.querySelector('#dashboardView');
const adminLogin = document.querySelector('#adminLogin');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const loginStatus = document.querySelector('#loginStatus');
const twoFactorPanel = document.querySelector('#twoFactorPanel');
const twoFactorSetup = document.querySelector('#twoFactorSetup');
const twoFactorSecret = document.querySelector('#twoFactorSecret');
const twoFactorLink = document.querySelector('#twoFactorLink');
const twoFactorCode = document.querySelector('#twoFactorCode');
const verifyTwoFactorButton = document.querySelector('#verifyTwoFactor');
const adminEmail = document.querySelector('#adminEmail');
const logoutButton = document.querySelector('#logout');
const refreshButton = document.querySelector('#refresh');
const createUserForm = document.querySelector('#createUser');
const createStatus = document.querySelector('#createStatus');
const usersBody = document.querySelector('#usersBody');
const eventsBody = document.querySelector('#eventsBody');
const pendingPaymentsBody = document.querySelector('#pendingPaymentsBody');
const pendingPaymentCount = document.querySelector('#pendingPaymentCount');
const emailHistoryBody = document.querySelector('#emailHistoryBody');
const sequenceFlowFilter = document.querySelector('#sequenceFlowFilter');
const sequenceBody = document.querySelector('#sequenceBody');
const sequenceCount = document.querySelector('#sequenceCount');
const workflowTabs = document.querySelector('#workflowTabs');
const workflowInsight = document.querySelector('#workflowInsight');
const userSearch = document.querySelector('#userSearch');
const statusFilter = document.querySelector('#statusFilter');
const roleFilter = document.querySelector('#roleFilter');
const planFilterStatus = document.querySelector('#planFilterStatus');
const agentInsights = document.querySelector('#agentInsights');
const statPaidRevenue = document.querySelector('#statPaidRevenue');
const statPaidOrders = document.querySelector('#statPaidOrders');
const statPendingOrders = document.querySelector('#statPendingOrders');
const statPendingRevenue = document.querySelector('#statPendingRevenue');
const statActiveLabel = document.querySelector('#statActiveLabel');
const statAttentionUsers = document.querySelector('#statAttentionUsers');
const statAttentionLabel = document.querySelector('#statAttentionLabel');
const statSuccessRate = document.querySelector('#statSuccessRate');
const statEmailCare = document.querySelector('#statEmailCare');
const salesFocusTitle = document.querySelector('#salesFocusTitle');
const salesFocusText = document.querySelector('#salesFocusText');
const accountFocusTitle = document.querySelector('#accountFocusTitle');
const accountFocusText = document.querySelector('#accountFocusText');
const opsFocusTitle = document.querySelector('#opsFocusTitle');
const opsFocusText = document.querySelector('#opsFocusText');
const resetRenderOpsButton = document.querySelector('#resetRenderOps');
const emailFocusTitle = document.querySelector('#emailFocusTitle');
const emailFocusText = document.querySelector('#emailFocusText');
const emailSentCount = document.querySelector('#emailSentCount');
const emailNeedsFollowUp = document.querySelector('#emailNeedsFollowUp');
const emailSequenceStepCount = document.querySelector('#emailSequenceStepCount');
const emailSequenceFlowLabel = document.querySelector('#emailSequenceFlowLabel');
const emailNoLoginCount = document.querySelector('#emailNoLoginCount');
const emailPriorityTitle = document.querySelector('#emailPriorityTitle');
const emailPriorityText = document.querySelector('#emailPriorityText');
const emailSequenceTitle = document.querySelector('#emailSequenceTitle');
const emailSequenceText = document.querySelector('#emailSequenceText');
const USER_API = '/api/9router/user';
const ADMIN_API = '/api/9router/admin';

let token = localStorage.getItem('adminToken') || '';
let currentAdmin = null;
let cachedUsers = [];
let cachedEvents = [];
let cachedOrders = [];
let cachedEmailHistory = [];
let activePlanFilter = 'all';
let pendingTwoFactor = null;
const DEFAULT_RENDER_OPS_RESET_AT = '2026-05-29T08:12:00.000Z';
let renderOpsResetAt = localStorage.getItem('renderOpsResetAt') || DEFAULT_RENDER_OPS_RESET_AT;

const planLabels = {
  all: 'Tất cả gói',
  trial: 'Dùng thử',
  monthly: 'Gói tháng',
  vip: 'VIP'
};

const buildEmailSequence = (flow, rows) => rows.map(([day, stage, trigger, subject, goal, action]) => ({
  flow,
  day,
  stage,
  trigger,
  subject,
  goal,
  action
}));

const emailSequences = [
  ...buildEmailSequence('pending', [
    [0, 'X\u00e1c nh\u1eadn \u0111\u01a1n', 'V\u1eeba t\u1ea1o \u0111\u01a1n tr\u1ea3 ph\u00ed', '\u0110\u00e3 nh\u1eadn th\u00f4ng tin \u0111\u0103ng k\u00fd DG Image Tools', 'X\u00e1c nh\u1eadn m\u00e3 chuy\u1ec3n kho\u1ea3n v\u00e0 m\u1edf k\u00eanh t\u01b0 v\u1ea5n', 'G\u1eedi email/Zalo x\u00e1c nh\u1eadn g\u00f3i, s\u1ed1 ti\u1ec1n, m\u00e3 chuy\u1ec3n kho\u1ea3n; h\u1ecfi kh\u00e1ch c\u00f3 c\u1ea7n t\u01b0 v\u1ea5n g\u00f3i ho\u1eb7c h\u1ed7 tr\u1ee3 thanh to\u00e1n kh\u00f4ng'],
    [0, 'Nh\u1eafc sau 1 gi\u1edd', '\u0110\u00e3 t\u1ea1o \u0111\u01a1n nh\u01b0ng ch\u01b0a thanh to\u00e1n', 'Anh/ch\u1ecb c\u00f3 c\u1ea7n t\u01b0 v\u1ea5n tr\u01b0\u1edbc khi thanh to\u00e1n kh\u00f4ng?', 'G\u1ee1 r\u00e0o c\u1ea3n tr\u01b0\u1edbc khi kh\u00e1ch r\u1eddi \u0111i', 'Nh\u1eafn Zalo/call nh\u1eb9: x\u00e1c nh\u1eadn nhu c\u1ea7u l\u00e0m thumbnail, nh\u1eafc chuy\u1ec3n \u0111\u00fang n\u1ed9i dung n\u1ebfu mu\u1ed1n ti\u1ebfp t\u1ee5c'],
    [1, 'Nh\u1eafc 24 gi\u1edd', 'Qua 24 gi\u1edd ch\u01b0a thanh to\u00e1n', '\u0110\u01a1n DG Image Tools c\u1ee7a anh/ch\u1ecb v\u1eabn \u0111ang \u0111\u01b0\u1ee3c gi\u1eef', 'K\u00e9o l\u1ea1i kh\u00e1ch c\u00f2n nhu c\u1ea7u', 'G\u1eedi l\u1ea1i m\u00e3 chuy\u1ec3n kho\u1ea3n, nh\u1eafc l\u1ee3i \u00edch theo g\u00f3i v\u00e0 h\u1ecfi v\u01b0\u1edbng gi\u00e1, c\u00e0i \u0111\u1eb7t hay ch\u1ea5t l\u01b0\u1ee3ng \u1ea3nh'],
    [3, 'T\u01b0 v\u1ea5n l\u1ea1i', '2-3 ng\u00e0y ch\u01b0a thanh to\u00e1n', 'M\u00ecnh t\u01b0 v\u1ea5n l\u1ea1i g\u00f3i ph\u00f9 h\u1ee3p \u0111\u1ec3 anh/ch\u1ecb kh\u1ecfi mua sai', 'Chuy\u1ec3n t\u1eeb nh\u1eafc ti\u1ec1n sang t\u01b0 v\u1ea5n', 'H\u1ecfi t\u1ea7n su\u1ea5t l\u00e0m \u1ea3nh, s\u1ed1 k\u00eanh, c\u00f3 team kh\u00f4ng; g\u1ee3i \u00fd G\u00f3i th\u00e1ng/VIP/D\u00f9ng th\u1eed ph\u00f9 h\u1ee3p'],
    [7, '\u0110\u00f3ng v\u00f2ng', '7 ng\u00e0y ch\u01b0a thanh to\u00e1n', 'Anh/ch\u1ecb c\u00f2n mu\u1ed1n gi\u1eef \u0111\u01a1n DG Image Tools kh\u00f4ng?', 'D\u1ecdn pipeline v\u00e0 xin ph\u1ea3n h\u1ed3i', 'H\u1ecfi 1 c\u00e2u ng\u1eafn v\u1ec1 l\u00fd do ch\u01b0a thanh to\u00e1n; n\u1ebfu ch\u01b0a s\u1eb5n s\u00e0ng th\u00ec chuy\u1ec3n sang danh s\u00e1ch nu\u00f4i lead']
  ]),
  ...buildEmailSequence('free', [
    [1, 'Kích hoạt', 'Vừa đăng ký free', 'Tài khoản dùng thử DG Image Tools đã sẵn sàng', 'Giao tài khoản và video bắt đầu', 'Gửi email tài khoản + video cài app/đăng nhập/tạo ảnh đầu tiên'],
    [1, 'Nhắc nhanh', 'Sau 3-6 giờ chưa đăng nhập', 'Anh/chị đã nhận được tài khoản dùng thử chưa?', 'Giảm mất khách vì không check mail', 'Zalo/SMS nhắc kiểm tra Inbox/Spam và gửi lại video nếu cần'],
    [2, 'Onboarding', 'Chưa đăng nhập hoặc quotaUsed = 0', 'Video 2 phút: tạo ảnh đầu tiên bằng DG Image Tools', 'Đẩy khách tạo ảnh đầu tiên', 'Gửi video tạo ảnh đầu tiên + 3 prompt mẫu để copy'],
    [3, 'Giá trị', 'Đã tạo 1-2 ảnh', 'Cách tạo 5 biến thể thumbnail để chọn ảnh tốt nhất', 'Tăng trải nghiệm dùng thử', 'Gửi mẹo tạo biến thể, sửa prompt và lưu mẫu tốt'],
    [4, 'Xử lý kẹt', 'Chưa dùng app', 'Cần em hỗ trợ cài app hoặc đăng nhập lần đầu không?', 'Mở lời hỗ trợ trực tiếp', 'Zalo hỏi khó khăn, đề nghị remote/call ngắn nếu cần'],
    [5, 'Bán đuổi mềm', 'Đã dùng từ 3 ảnh trở lên', 'Nếu làm thumbnail đều, gói tháng sẽ tiết kiệm thời gian hơn', 'Mở nhu cầu nâng cấp', 'Giới thiệu gói tháng 100 ảnh và lợi ích làm đều hằng tuần'],
    [6, 'Case use', 'Đang còn trial', 'Một quy trình tạo thumbnail nhanh cho kênh YouTube', 'Gắn app vào công việc hằng ngày', 'Gửi workflow: ý tưởng -> prompt -> biến thể -> chọn ảnh -> tối ưu'],
    [7, 'Chốt trial', 'Trial sắp hết hoặc đã hết', 'Dùng thử sắp kết thúc, nâng cấp để dùng tiếp quota', 'Chốt lên trả phí', 'Gửi lời mời nâng cấp gói tháng/VIP + nhắc tài khoản vẫn được giữ'],
    [8, 'Hỏi lý do', 'Chưa mua', 'Anh/chị thấy DG Image Tools còn vướng điểm nào?', 'Thu feedback và cứu deal', 'Hỏi 1 câu ngắn: giá, cài đặt, chất lượng ảnh hay nhu cầu khác'],
    [9, 'Giá trị nâng cao', 'Đã tạo ảnh nhưng chưa mua', 'Mẹo làm ảnh ổn định hơn: prompt mẫu theo ngách', 'Tăng niềm tin trước khi bán', 'Gửi prompt mẫu cho tài chính, review, giáo dục, drama, podcast'],
    [10, 'Offer', 'Đã dùng nhiều nhưng chưa mua', 'Mở khóa thêm quota để tiếp tục tạo ảnh', 'Chốt gói tháng', 'Gửi offer gói tháng, nhấn mạnh 100 ảnh/tháng và hỗ trợ setup'],
    [11, 'Hỗ trợ', 'Chưa đăng nhập', 'Em có thể gửi lại thông tin đăng nhập qua Zalo', 'Xử lý khách không check email', 'Gửi lại tài khoản qua Zalo/SMS nếu có số điện thoại'],
    [12, 'So sánh', 'Đã tạo 1-5 ảnh', 'Khi nào nên dùng gói tháng thay vì dùng thử?', 'Làm rõ lý do trả phí', 'So sánh quota, tốc độ làm việc, hỗ trợ và dùng ổn định hằng ngày'],
    [13, 'Bằng chứng', 'Chưa mua', 'Cách dùng app để tạo ảnh cho 1 video mới trong 10 phút', 'Biến lợi ích thành tình huống cụ thể', 'Gửi mini case workflow tạo thumbnail cho 1 video'],
    [14, 'Chốt 2', 'Chưa mua', 'Cần thêm quota hay cần hỗ trợ tạo mẫu ảnh tốt hơn?', 'Chốt bằng hỗ trợ', 'Mời nâng cấp hoặc hẹn hỗ trợ tối ưu prompt'],
    [15, 'Tái kích hoạt', 'Im lặng', 'Anh/chị có muốn em giữ tài khoản dùng thử thêm không?', 'Kéo phản hồi', 'Hỏi có muốn gia hạn trial ngắn nếu thực sự cần test tiếp'],
    [16, 'Nỗi đau', 'Khách làm YouTube/marketing', 'Dùng app để giảm thời gian làm ảnh mỗi ngày', 'Đánh vào lợi ích tiết kiệm thời gian', 'Gửi nội dung về rút ngắn việc lên ý tưởng và tạo biến thể'],
    [17, 'Prompt', 'Đã đăng nhập', '5 prompt mẫu để test lại DG Image Tools', 'Kéo khách quay lại app', 'Gửi 5 prompt copy nhanh và yêu cầu tạo thử 3 ảnh'],
    [18, 'Xử lý phân vân', 'Chưa mua', 'Nếu anh/chị chỉ cần làm ít ảnh thì nên chọn gói nào?', 'Giảm cản trở về giá', 'Gợi ý gói tháng cho cá nhân, VIP cho team/nhiều kênh'],
    [19, 'Hỗ trợ 1-1', 'Đã tạo ảnh nhưng chất lượng chưa tốt', 'Gửi em 1 ảnh mẫu, em gợi ý prompt tối ưu', 'Tăng tỷ lệ thành công', 'Mời khách gửi ảnh mẫu/chủ đề để tư vấn prompt'],
    [20, 'Chốt nhẹ', 'Chưa mua', 'Tài khoản của anh/chị vẫn có thể nâng cấp để dùng tiếp', 'Nhắc mua không gây áp lực', 'Nhắc tài khoản đã có sẵn, thanh toán xong là dùng tiếp'],
    [21, 'Tổng kết', 'Hết trial 2 tuần', 'Tổng kết dùng thử DG Image Tools', 'Kết thúc đợt chăm sóc 1', 'Tóm tắt lợi ích, hỏi feedback, CTA nâng cấp'],
    [22, 'Reactivation', 'Không hoạt động', 'Anh/chị muốn nhận bộ prompt mới miễn phí không?', 'Lấy lại tương tác', 'Gửi bộ prompt mẫu nếu khách phản hồi'],
    [23, 'Niche', 'Có thông tin ngách', 'Prompt riêng cho ngách của anh/chị', 'Cá nhân hóa', 'Gửi prompt theo ngách hoặc hỏi thêm ngách nếu chưa có'],
    [24, 'FAQ', 'Chưa mua', 'Câu hỏi thường gặp trước khi nâng cấp', 'Giải đáp cản trở', 'Trả lời về quota, thiết bị, thanh toán, hỗ trợ, hết hạn'],
    [25, 'Ưu tiên', 'Đã dùng khá nhiều', 'Nên nâng gói nếu anh/chị tạo ảnh đều mỗi tuần', 'Chốt nhóm có ý định cao', 'Gửi gợi ý mua gói tháng/VIP theo tần suất dùng'],
    [26, 'Giá trị', 'Chưa mua', 'Dùng thumbnail tốt để test nhiều ý tưởng video hơn', 'Nói về đầu ra kinh doanh', 'Liên hệ ảnh tốt với CTR/ý tưởng video, không hứa quá mức'],
    [27, 'Hỏi nhu cầu', 'Im lặng', 'Anh/chị đang cần tạo loại ảnh nào nhất?', 'Phân loại lead', 'Hỏi nhu cầu: YouTube, ads, sản phẩm, giáo dục, khác'],
    [28, 'Chốt cuối', 'Chưa mua', 'Lần nhắc cuối về gói dùng tiếp DG Image Tools', 'Kết thúc bán đuổi chính', 'CTA rõ ràng nâng cấp hoặc để lại nhu cầu hỗ trợ'],
    [29, 'Nurture', 'Không mua', 'Em sẽ gửi mẹo tạo ảnh mới khi có cập nhật hay', 'Giữ lead dài hạn', 'Chuyển sang danh sách nội dung tháng'],
    [30, 'Đóng vòng', 'Không mua sau 30 ngày', 'Cần em mở lại trial khi anh/chị sẵn sàng test tiếp không?', 'Đóng vòng 30 ngày', 'Hỏi xin phép liên hệ lại khi có mẫu/video mới'],
    [45, 'Tái kích hoạt', 'Lead cũ', 'DG Image Tools có thêm workflow/prompt mới cho anh/chị', 'Mở lại cơ hội bán', 'Gửi cập nhật mới + mời test lại nếu phù hợp'],
    [60, 'Re-offer', 'Lead cũ có tương tác', 'Muốn dùng lại DG Image Tools với gói tháng không?', 'Bán lại lead cũ', 'Gửi offer ngắn + hỗ trợ setup lại']
  ]),
  ...buildEmailSequence('paid', [
    [1, 'Kích hoạt', 'Vừa thanh toán', 'Tài khoản DG Image Tools của anh/chị đã được kích hoạt', 'Giao tài khoản và đảm bảo bắt đầu dùng', 'Gửi tài khoản + video cài app/đăng nhập/tạo ảnh đầu tiên + checklist'],
    [1, 'Nhắc nhanh', 'Sau 3-6 giờ chưa đăng nhập', 'Em gửi lại video hướng dẫn đăng nhập DG Image Tools', 'Không để khách trả phí bị kẹt', 'Zalo/SMS nhắc check email/spam, đề nghị gửi lại thông tin'],
    [2, 'Onboarding', 'Đã đăng nhập nhưng quotaUsed = 0', 'Video: tạo ảnh đầu tiên và lưu kết quả', 'Đẩy khách tạo ảnh đầu tiên', 'Gửi video tạo ảnh đầu tiên + prompt mẫu theo ngách'],
    [3, 'Tối ưu', 'Đã tạo ảnh', 'Cách viết prompt để ảnh đẹp và đúng ý hơn', 'Tăng chất lượng đầu ra', 'Gửi video prompt nâng cao + 5 lỗi thường gặp'],
    [4, 'Hỗ trợ', 'Dùng ít hoặc lỗi', 'Anh/chị có cần em xem giúp prompt/ảnh mẫu không?', 'Giảm bỏ cuộc sớm', 'Mời gửi ảnh mẫu/chủ đề để tư vấn nhanh'],
    [5, 'Workflow', 'Đã tạo 3+ ảnh', 'Quy trình tạo 5-10 biến thể thumbnail mỗi ngày', 'Đưa app vào công việc lặp lại', 'Gửi workflow tạo biến thể, chọn ảnh, sửa prompt, lưu mẫu'],
    [6, 'Niche', 'Có note/ngách', 'Prompt tối ưu theo ngách của anh/chị', 'Cá nhân hóa', 'Gửi prompt theo ngách hoặc hỏi thêm ngách'],
    [7, 'Kiểm tra 1 tuần', 'Sau 7 ngày', 'Sau 1 tuần dùng DG Image Tools, anh/chị cần tối ưu điểm nào?', 'Lấy feedback và giảm churn', 'Hỏi 1 câu ngắn, đề nghị hỗ trợ nếu quotaUsed thấp'],
    [8, 'Mẹo nâng cao', 'Đang dùng bình thường', 'Mẹo tạo ảnh ổn định hơn giữa các lần render', 'Tăng hiệu quả công việc', 'Gửi cách cố định style, bố cục, màu sắc, chữ, nhân vật'],
    [9, 'Lưu prompt', 'Đã tạo nhiều ảnh', 'Nên lưu lại prompt thắng để tái sử dụng', 'Giúp khách làm nhanh hơn', 'Hướng dẫn tạo thư viện prompt cá nhân theo ngách'],
    [10, 'Kiểm tra quota', 'QuotaUsed thấp', 'Anh/chị chưa dùng nhiều, có cần em hỗ trợ setup workflow?', 'Cứu khách dùng ít', 'Zalo chủ động hỏi và đề nghị call 10 phút'],
    [11, 'Kiểm tra quota', 'QuotaUsed cao', 'Anh/chị đang dùng tốt, có cần thêm quota/VIP không?', 'Mở upsell VIP', 'Gợi ý VIP nếu gần hết quota hoặc dùng nhiều kênh'],
    [12, 'Case use', 'Đang dùng', 'Mẫu workflow cho 1 video YouTube mới', 'Tăng giá trị sử dụng', 'Gửi quy trình từ tiêu đề video đến 5 mẫu thumbnail'],
    [13, 'Chất lượng', 'Có lỗi render hoặc kết quả kém', 'Cách sửa prompt khi ảnh chưa đúng ý', 'Giảm thất vọng về chất lượng', 'Gửi checklist sửa prompt: bố cục, đối tượng, cảm xúc, nền, chữ'],
    [14, 'Tổng kết 2 tuần', 'Sau 14 ngày', 'Kiểm tra nhanh hiệu quả DG Image Tools của anh/chị', 'Đánh giá sử dụng nửa tháng', 'Nếu dùng ít thì hỗ trợ; nếu dùng tốt thì gợi ý workflow nâng cao'],
    [15, 'Đào tạo', 'Đang dùng', 'Video nâng cao: tạo ảnh theo style riêng', 'Tăng sự phụ thuộc vào workflow', 'Gửi video/style guide và cách tạo prompt mẫu'],
    [16, 'Thiết bị', 'Có nhiều thiết bị/team', 'Cách quản lý thiết bị và quota cho team', 'Hỗ trợ team/VIP', 'Hướng dẫn device limit, khi nào cần nâng VIP'],
    [17, 'Năng suất', 'Đã dùng 10+ ảnh', 'Cách tạo lô ảnh hàng loạt mà vẫn giữ style', 'Tăng sản lượng', 'Gửi mẹo batch prompt, đặt tên file, lưu mẫu tốt'],
    [18, 'Chăm sóc', 'Không hoạt động 5 ngày', 'Anh/chị có đang bị kẹt ở bước nào không?', 'Kéo quay lại', 'Zalo hỏi trực tiếp, gửi lại video phù hợp'],
    [19, 'Tối ưu CTR', 'YouTube', '3 cách test thumbnail cho cùng một video', 'Liên hệ app với kết quả công việc', 'Gửi cách tạo 3 concept: cảm xúc, so sánh, câu hỏi'],
    [20, 'Kiểm tra quota', 'Gần hết quota', 'Tài khoản của anh/chị sắp hết quota tạo ảnh', 'Upsell quota/VIP', 'Gợi ý nâng VIP hoặc mua thêm quota nếu có chính sách'],
    [21, 'Tổng kết 3 tuần', 'Sau 21 ngày', '3 tuần sử dụng: có nên tối ưu lại workflow không?', 'Giảm rời bỏ trước gia hạn', 'Hỏi feedback, đề nghị xem prompt/ảnh mẫu'],
    [22, 'Mẹo', 'Đang dùng', 'Bộ prompt mẫu cho ảnh sản phẩm/marketing', 'Mở rộng use case', 'Gửi prompt marketing nếu phù hợp, nếu không gửi prompt YouTube'],
    [23, 'Bảo trì', 'Có lỗi gần đây', 'Nếu app báo lỗi, hãy gửi em ảnh màn hình này', 'Giảm friction hỗ trợ', 'Hướng dẫn gửi lỗi: email, thời gian, ảnh màn hình, prompt'],
    [24, 'Gia hạn sớm', 'Còn 6 ngày hết hạn', 'Tài khoản còn khoảng 1 tuần, anh/chị có muốn gia hạn sớm không?', 'Mở đầu gia hạn', 'Nhắc gia hạn sớm nếu đang dùng tốt; nếu dùng ít thì đề nghị hỗ trợ'],
    [25, 'Gia hạn', 'Còn 5 ngày hết hạn', 'Gia hạn DG Image Tools để không gián đoạn công việc', 'Gia hạn', 'Gửi thông tin gia hạn + lợi ích tiếp tục workflow'],
    [26, 'Gia hạn/upsell', 'Dùng nhiều', 'Anh/chị có nên lên VIP tháng tới không?', 'Upsell VIP', 'So sánh gói tháng và VIP theo quota/thiết bị/team'],
    [27, 'Hỏi vấn đề', 'Dùng ít', 'Nếu tháng này anh/chị dùng ít, em có thể hỗ trợ tối ưu lại', 'Cứu gia hạn', 'Hỏi lý do dùng ít và đề nghị setup workflow mới'],
    [28, 'Nhắc hết hạn', 'Còn 2 ngày hết hạn', 'Tài khoản sắp hết hạn sau 2 ngày', 'Gia hạn rõ ràng', 'Gửi CTA gia hạn, nhắc không gián đoạn quota/công việc'],
    [29, 'Nhắc cuối', 'Còn 1 ngày hết hạn', 'Ngày mai tài khoản DG Image Tools sẽ hết hạn', 'Chốt gia hạn', 'Gửi nhắc cuối + kênh thanh toán/hỗ trợ'],
    [30, 'Hết hạn', 'Hết hạn/chưa gia hạn', 'Tài khoản đã hết hạn, gia hạn để dùng tiếp', 'Khôi phục', 'Gửi lời mời gia hạn, nếu dùng ít thì đề nghị hỗ trợ trước khi gia hạn'],
    [45, 'Winback', 'Khách hết hạn 15 ngày', 'Anh/chị có muốn kích hoạt lại DG Image Tools không?', 'Lấy lại khách cũ', 'Gửi cập nhật mới + mời gia hạn lại'],
    [60, 'Winback', 'Khách cũ im lặng', 'DG Image Tools có thêm workflow mới để tạo ảnh nhanh hơn', 'Winback dài hạn', 'Gửi video/cập nhật mới + offer hỗ trợ setup lại']
  ])
];

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(body.message || 'Yêu cầu thất bại.');
  }

  return body;
};

const setLoggedIn = (loggedIn, user = null) => {
  loginView.classList.toggle('hidden', loggedIn);
  dashboardView.classList.toggle('hidden', !loggedIn);
  adminEmail.textContent = user?.email || 'Đang quản lý hệ thống';
  logoutButton.hidden = !loggedIn;
};

const resetTwoFactorFlow = () => {
  pendingTwoFactor = null;
  twoFactorPanel.classList.add('hidden');
  twoFactorSetup.classList.add('hidden');
  twoFactorSecret.textContent = '';
  twoFactorLink.removeAttribute('href');
  twoFactorCode.value = '';
  verifyTwoFactorButton.disabled = false;
};

const showTwoFactorFlow = (result) => {
  pendingTwoFactor = {
    tempToken: result.tempToken,
    setup: Boolean(result.requiresTwoFactorSetup)
  };
  twoFactorPanel.classList.remove('hidden');
  twoFactorSetup.classList.toggle('hidden', !pendingTwoFactor.setup);
  twoFactorSecret.textContent = result.setupSecret || '';
  if (result.otpauthUrl) {
    twoFactorLink.href = result.otpauthUrl;
  }
  twoFactorCode.value = '';
  twoFactorCode.focus();
};

const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';
const formatShortDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';
const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatOrderAge = (value) => {
  if (!value) return '-';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  if (hours < 1) return 'Vừa tạo, nhắn xác nhận nội dung chuyển khoản';
  if (hours < 24) return `${hours} giờ chưa thanh toán, Zalo nhắc chuyển đúng mã`;
  const days = Math.floor(hours / 24);
  return `${days} ngày chưa thanh toán, gọi/Zalo hỏi còn nhu cầu không`;
};

const workflowMeta = {
  pending: { label: '\u0110\u01a1n ch\u1edd thanh to\u00e1n', short: '\u0110\u01a1n ch\u1edd', tone: 'warning', description: 'X\u1eed l\u00fd lead \u0111\u00e3 \u0111\u1ec3 l\u1ea1i th\u00f4ng tin nh\u01b0ng ch\u01b0a thanh to\u00e1n: x\u00e1c nh\u1eadn, nh\u1eafc m\u1ec1m, t\u01b0 v\u1ea5n l\u1ea1i v\u00e0 \u0111\u00f3ng v\u00f2ng.' },
  trial: { label: 'Th\u00e0nh vi\u00ean d\u00f9ng th\u1eed', short: 'D\u00f9ng th\u1eed', tone: 'info', description: '\u0110\u01b0a kh\u00e1ch \u0111\u0103ng nh\u1eadp, t\u1ea1o \u1ea3nh \u0111\u1ea7u ti\u00ean, th\u1ea5y gi\u00e1 tr\u1ecb v\u00e0 n\u00e2ng c\u1ea5p l\u00ean tr\u1ea3 ph\u00ed.' },
  free: { label: 'Th\u00e0nh vi\u00ean d\u00f9ng th\u1eed', short: 'D\u00f9ng th\u1eed', tone: 'info', description: '\u0110\u01b0a kh\u00e1ch \u0111\u0103ng nh\u1eadp, t\u1ea1o \u1ea3nh \u0111\u1ea7u ti\u00ean, th\u1ea5y gi\u00e1 tr\u1ecb v\u00e0 n\u00e2ng c\u1ea5p l\u00ean tr\u1ea3 ph\u00ed.' },
  paid: { label: 'Th\u00e0nh vi\u00ean tr\u1ea3 ph\u00ed', short: 'Tr\u1ea3 ph\u00ed', tone: 'success', description: '\u0110\u1ea3m b\u1ea3o kh\u00e1ch b\u1eaft \u0111\u1ea7u d\u00f9ng \u0111\u01b0\u1ee3c, t\u1ea1o \u1ea3nh \u0111\u1ea7u ti\u00ean, \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 prompt v\u00e0 d\u00f9ng app \u0111\u1ec1u.' },
  renewal: { label: 'Gia h\u1ea1n / winback', short: 'Gia h\u1ea1n', tone: 'danger', description: 'Nh\u1eafc h\u1ebft h\u1ea1n, g\u1ee3i \u00fd n\u00e2ng VIP, c\u1ee9u kh\u00e1ch d\u00f9ng \u00edt v\u00e0 k\u00edch ho\u1ea1t l\u1ea1i kh\u00e1ch c\u0169.' }
};

const workflowOrder = ['pending', 'trial', 'paid', 'renewal'];

const getFlowLabel = (flow) => workflowMeta[flow]?.label || workflowMeta.trial.label;

const getPendingPaymentCareAction = (order) => {
  if (!order.customerEmailSentAt) {
    return 'G\u1eedi email/Zalo x\u00e1c nh\u1eadn \u0111\u01a1n, m\u00e3 chuy\u1ec3n kho\u1ea3n v\u00e0 h\u1ecfi kh\u00e1ch c\u00f3 c\u1ea7n t\u01b0 v\u1ea5n g\u00f3i tr\u01b0\u1edbc khi thanh to\u00e1n kh\u00f4ng.';
  }

  const hours = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt || 0).getTime()) / 3600000));
  if (hours < 6) return 'Nh\u1eafn Zalo ki\u1ec3m tra kh\u00e1ch \u0111\u00e3 th\u1ea5y m\u00e3 chuy\u1ec3n kho\u1ea3n ch\u01b0a; kh\u00f4ng \u00e9p mua, m\u1edf l\u1eddi t\u01b0 v\u1ea5n n\u1ebfu c\u00f2n ph\u00e2n v\u00e2n.';
  if (hours < 24) return 'Nh\u1eafc m\u1ec1m: \u0111\u01a1n v\u1eabn \u0111\u01b0\u1ee3c gi\u1eef, chuy\u1ec3n kho\u1ea3n \u0111\u00fang m\u00e3 ho\u1eb7c tr\u1ea3 l\u1eddi n\u1ebfu c\u1ea7n t\u01b0 v\u1ea5n g\u00f3i ph\u00f9 h\u1ee3p.';
  if (hours < 72) return 'G\u1ecdi/Zalo h\u1ecfi v\u01b0\u1edbng \u1edf gi\u00e1, c\u00e0i \u0111\u1eb7t hay ch\u1ea5t l\u01b0\u1ee3ng \u1ea3nh; g\u1ee3i \u00fd d\u00f9ng th\u1eed n\u1ebfu kh\u00e1ch ch\u01b0a ch\u1eafc.';
  return 'Ch\u1ed1t nhu c\u1ea7u: h\u1ecfi c\u00f2n mu\u1ed1n gi\u1eef \u0111\u01a1n kh\u00f4ng, n\u1ebfu ch\u01b0a s\u1eb5n s\u00e0ng th\u00ec chuy\u1ec3n sang nu\u00f4i lead d\u00e0i h\u1ea1n.';
};

const getEmailRecommendedAction = (email) => {
  const used = Number(email.quotaUsed || 0);
  const isPaid = normalizeText(email.planName).includes('thang') || normalizeText(email.planName).includes('vip') || email.status === 'paid';

  if (!email.lastLoginAt) {
    return isPaid
      ? 'Kh\u00e1ch tr\u1ea3 ph\u00ed ch\u01b0a \u0111\u0103ng nh\u1eadp: g\u1ecdi/Zalo ngay, g\u1eedi l\u1ea1i t\u00e0i kho\u1ea3n v\u00e0 video \u0111\u0103ng nh\u1eadp \u0111\u1ec3 tr\u00e1nh kh\u00e1ch b\u1ecb k\u1eb9t sau thanh to\u00e1n.'
      : 'Kh\u00e1ch d\u00f9ng th\u1eed ch\u01b0a \u0111\u0103ng nh\u1eadp: nh\u1eafc ki\u1ec3m tra Inbox/Spam, g\u1eedi l\u1ea1i t\u00e0i kho\u1ea3n qua Zalo v\u00e0 y\u00eau c\u1ea7u t\u1ea1o th\u1eed 1 \u1ea3nh h\u00f4m nay.';
  }

  if (used <= 0) {
    return '\u0110\u00e3 \u0111\u0103ng nh\u1eadp nh\u01b0ng ch\u01b0a t\u1ea1o \u1ea3nh: g\u1eedi 3 prompt m\u1eabu theo ng\u00e1ch v\u00e0 h\u01b0\u1edbng d\u1eabn t\u1ea1o \u1ea3nh \u0111\u1ea7u ti\u00ean trong 5 ph\u00fat.';
  }

  return email.recommendedAction || 'Theo d\u00f5i ti\u1ebfp: h\u1ecfi ch\u1ea5t l\u01b0\u1ee3ng \u1ea3nh c\u00f3 \u0111\u00fang \u00fd kh\u00f4ng v\u00e0 g\u1ee3i \u00fd n\u00e2ng c\u1ea5p n\u1ebfu kh\u00e1ch d\u00f9ng \u0111\u1ec1u.';
};

const appendTextCell = (row, value, className = '') => {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = value == null || value === '' ? '-' : String(value);
  return row.appendChild(cell);
};

const actionButton = (label, className, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const renderStatusPill = (text, blocked = false) => {
  const pill = document.createElement('span');
  pill.className = `pill${blocked ? ' blocked' : ''}`;
  pill.textContent = text;
  return pill;
};

const getDaysLeft = (expiresAt) => {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
};

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const getUserPlanKey = (user) => {
  const planName = normalizeText(user.planName);
  if (planName.includes('vip')) return 'vip';
  if (planName.includes('dung thu') || planName.includes('trial')) return 'trial';
  if (planName.includes('goi thang') || planName.includes('thang') || planName.includes('monthly')) return 'monthly';

  const quotaTotal = Number(user.quotaTotal || 0);
  const durationDays = Number(user.durationDays || 0);
  const deviceLimit = Number(user.deviceLimit || 1);
  if (quotaTotal <= 10 || (durationDays > 0 && durationDays <= 7)) return 'trial';
  if (quotaTotal >= 300 || deviceLimit >= 2) return 'vip';
  return 'monthly';
};

const getOperationalMetrics = () => {
  const renderResetTime = renderOpsResetAt ? new Date(renderOpsResetAt).getTime() : 0;
  const trackedEvents = renderResetTime
    ? cachedEvents.filter((event) => new Date(event.createdAt || 0).getTime() > renderResetTime)
    : cachedEvents;
  const pendingOrders = cachedOrders.filter((order) => order.status === 'pending_payment');
  const paidOrders = cachedOrders.filter((order) => order.status === 'paid' || order.paidAt);
  const paidRevenue = paidOrders.reduce((total, order) => total + Number(order.price || 0), 0);
  const pendingRevenue = pendingOrders.reduce((total, order) => total + Number(order.price || 0), 0);
  const activeUsers = cachedUsers.filter((user) => user.status === 'active');
  const lowQuota = cachedUsers.filter((user) => user.role !== 'admin' && Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0)) <= 5);
  const expiring = cachedUsers.filter((user) => {
    const daysLeft = getDaysLeft(user.expiresAt);
    return user.role !== 'admin' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  });
  const inactive = cachedUsers.filter((user) => user.role !== 'admin' && !user.activatedAt && user.status === 'active');
  const attentionIds = new Set([...lowQuota, ...expiring, ...inactive].map((user) => user.id));
  const successEvents = trackedEvents.filter((event) => event.ok).length;
  const failedEvents = trackedEvents.filter((event) => !event.ok).length;
  const totalEvents = successEvents + failedEvents;
  const successRate = totalEvents ? Math.round((successEvents / totalEvents) * 100) : 100;
  const emailNeedsCare = cachedEmailHistory.filter((email) => !email.lastLoginAt || Number(email.quotaUsed || 0) <= 0).length;

  return {
    pendingOrders,
    paidOrders,
    paidRevenue,
    pendingRevenue,
    activeUsers,
    lowQuota,
    expiring,
    inactive,
    attentionUsers: attentionIds.size,
    failedEvents,
    successRate,
    trackedEvents: trackedEvents.length,
    emailNeedsCare
  };
};

const renderDashboardSummary = () => {
  const metrics = getOperationalMetrics();
  const firstPending = metrics.pendingOrders[0] || null;

  statPaidRevenue.textContent = formatMoney(metrics.paidRevenue);
  statPaidOrders.textContent = `${metrics.paidOrders.length} đơn đã thanh toán`;
  statPendingOrders.textContent = metrics.pendingOrders.length;
  statPendingRevenue.textContent = `${formatMoney(metrics.pendingRevenue)} đang chờ`;
  statActiveLabel.textContent = `${metrics.activeUsers.length} đang hoạt động`;
  statAttentionUsers.textContent = metrics.attentionUsers;
  statAttentionLabel.textContent = `${metrics.lowQuota.length} quota thấp · ${metrics.expiring.length} sắp hết hạn`;
  statSuccessRate.textContent = `${metrics.successRate}% thành công`;
  statEmailCare.textContent = metrics.emailNeedsCare;

  salesFocusTitle.textContent = `${metrics.pendingOrders.length} đơn chờ thanh toán`;
  salesFocusText.textContent = metrics.pendingOrders.length
    ? `Tổng ${formatMoney(metrics.pendingRevenue)} đang chờ. Ưu tiên nhắc ${firstPending.customerName || firstPending.email || firstPending.code}.`
    : 'Không có khách chờ thanh toán trong danh sách gần đây.';

  accountFocusTitle.textContent = `${metrics.attentionUsers} tài khoản cần kiểm tra`;
  accountFocusText.textContent = `${metrics.lowQuota.length} quota thấp, ${metrics.expiring.length} sắp hết hạn, ${metrics.inactive.length} chưa kích hoạt.`;

  opsFocusTitle.textContent = `${metrics.failedEvents} lỗi mới sau reset`;
  opsFocusText.textContent = renderOpsResetAt
    ? `Đang theo dõi ${metrics.trackedEvents} tiến trình mới từ ${formatDate(renderOpsResetAt)}. Tỷ lệ thành công ${metrics.successRate}%.`
    : `Tỷ lệ render thành công ${metrics.successRate}%. Bấm reset để bắt đầu theo dõi tiến trình mới từ 0.`;

  emailFocusTitle.textContent = `${metrics.emailNeedsCare} khách cần nhắc`;
  emailFocusText.textContent = metrics.emailNeedsCare
    ? 'Ưu tiên khách đã nhận email nhưng chưa đăng nhập hoặc chưa tạo ảnh đầu tiên.'
    : 'Các khách đã nhận email không có dấu hiệu bị kẹt trong danh sách hiện tại.';
};

const updatePlanButtons = () => {
  document.querySelectorAll('.preset').forEach((button) => {
    button.classList.toggle('active', button.dataset.plan === activePlanFilter);
  });
  if (planFilterStatus) {
    planFilterStatus.textContent = activePlanFilter === 'all' ? '' : `Đang xem: ${planLabels[activePlanFilter]}`;
  }
};

const switchAdminTab = (targetSelector) => {
  if (!targetSelector) return;
  document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', `#${panel.id}` !== targetSelector);
  });
  document.querySelectorAll('.topbar-actions .nav-action').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === targetSelector);
  });
};

const getFilteredUsers = () => {
  const query = userSearch.value.trim().toLowerCase();
  const status = statusFilter.value;
  const role = roleFilter.value;
  return cachedUsers.filter((user) => {
    if (query && !String(user.email || '').includes(query)) return false;
    if (status !== 'all' && user.status !== status) return false;
    if (role !== 'all' && user.role !== role) return false;
    if (activePlanFilter !== 'all' && getUserPlanKey(user) !== activePlanFilter) return false;
    return true;
  });
};

const renderQuotaCell = (row, user) => {
  const used = Number(user.quotaUsed || 0);
  const total = Number(user.quotaTotal || 0);
  const remaining = Math.max(0, total - used);
  const usedRatio = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const cell = document.createElement('td');
  cell.className = 'quota-cell';

  if (user.role === 'admin') {
    cell.innerHTML = `
      <div class="quota-summary admin-quota">Không áp dụng</div>
      <div class="muted-text">Tài khoản quản trị không trừ quota thành viên</div>
    `;
    row.append(cell);
    return;
  }

  const quotaState = remaining <= 0 ? 'empty' : remaining <= 5 ? 'low' : 'ok';
  cell.innerHTML = `
    <div class="quota-summary ${quotaState}"><strong>${remaining}</strong><span>/ ${total} ảnh còn</span></div>
    <div class="meter" title="Đã dùng ${used}/${total} ảnh"><span style="width:${usedRatio}%"></span></div>
    <div class="muted-text">Đã dùng ${used} ảnh</div>
  `;
  row.append(cell);
};

const renderUsers = () => {
  const users = getFilteredUsers();
  updatePlanButtons();
  usersBody.replaceChildren(...users.map((user) => {
    const row = document.createElement('tr');
    const daysLeft = getDaysLeft(user.expiresAt);
    const isExpired = daysLeft !== null && daysLeft < 0;

    appendTextCell(row, user.email, 'email-cell');
    appendTextCell(row, user.role === 'admin' ? 'Admin' : 'User');

    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(user.status === 'active' ? 'Đang hoạt động' : 'Đã khóa', user.status !== 'active'));
    row.append(statusCell);

    renderQuotaCell(row, user);
    appendTextCell(row, Number(user.durationDays || 0) ? `${user.durationDays} ngày` : 'Không giới hạn');
    appendTextCell(row, formatShortDate(user.activatedAt));
    appendTextCell(row, user.expiresAt ? `${formatShortDate(user.expiresAt)}${isExpired ? ' · đã hết hạn' : daysLeft !== null ? ` · còn ${daysLeft} ngày` : ''}` : 'Chưa kích hoạt');
    appendTextCell(row, `${(user.devices || []).length}/${user.deviceLimit}`);
    appendTextCell(row, formatDate(user.lastLoginAt));

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    if (user.id === currentAdmin?.id) {
      const currentPill = document.createElement('span');
      currentPill.className = 'pill';
      currentPill.textContent = 'Đang đăng nhập';
      actions.append(currentPill);
    } else {
      actions.append(
        actionButton(user.status === 'active' ? 'Khóa' : 'Mở khóa', 'danger', () => updateUser(user.id, { status: user.status === 'active' ? 'blocked' : 'active' })),
        actionButton('Reset đã dùng', 'secondary', () => updateUser(user.id, { quotaUsed: 0 })),
        actionButton('Xóa thiết bị', 'secondary', () => updateUser(user.id, { clearDevices: true })),
        actionButton('+100 quota', 'secondary', () => updateUser(user.id, { quotaTotal: Number(user.quotaTotal || 0) + 100 }))
      );
    }
    actionsCell.append(actions);
    row.append(actionsCell);
    return row;
  }));
};

const renderEvents = (events) => {
  eventsBody.replaceChildren(...events.map((event) => {
    const row = document.createElement('tr');
    appendTextCell(row, formatDate(event.createdAt));
    appendTextCell(row, event.email || '-');

    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(event.ok ? 'Thành công' : 'Lỗi', !event.ok));
    row.append(statusCell);

    appendTextCell(row, event.deviceId || '-');
    const promptCell = appendTextCell(row, event.error || event.prompt || '', 'prompt-cell');
    promptCell.title = event.error || event.prompt || '';
    return row;
  }));
};

const renderEmailHistory = (emails) => {
  emailHistoryBody.replaceChildren(...emails.map((email) => {
    const row = document.createElement('tr');
    appendTextCell(row, formatDate(email.sentAt));
    appendTextCell(row, email.to || '-', 'email-cell');
    appendTextCell(row, email.customerName || '-');
    appendTextCell(row, email.orderCode || '-');
    const isStuck = !email.lastLoginAt || Number(email.quotaUsed || 0) <= 0;
    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(email.usageStatus || 'Chưa rõ', isStuck));
    row.append(statusCell);
    appendTextCell(row, formatDate(email.lastLoginAt));
    appendTextCell(row, `${Number(email.quotaUsed || 0)}/${Number(email.quotaTotal || 0)} ảnh`);
    appendTextCell(row, getEmailRecommendedAction(email), 'prompt-cell');
    appendTextCell(row, email.planName || '-');
    appendTextCell(row, formatShortDate(email.expiresAt));
    return row;
  }));
};

const getEmailWorkflowRows = (flow) => {
  if (flow === 'trial') {
    return emailSequences.filter((item) => item.flow === 'free');
  }

  if (flow === 'paid') {
    return emailSequences.filter((item) => item.flow === 'paid' && Number(item.day || 0) < 24);
  }

  if (flow === 'renewal') {
    return emailSequences.filter((item) => item.flow === 'paid' && Number(item.day || 0) >= 24);
  }

  return emailSequences.filter((item) => item.flow === flow);
};

const getWorkflowDescription = (flow) => workflowMeta[flow]?.description || 'Workflow ch\u0103m s\u00f3c th\u00e0nh vi\u00ean theo tr\u1ea1ng th\u00e1i s\u1eed d\u1ee5ng.';

const renderEmailCenterSummary = (sequenceRows = []) => {
  const needsFollowUp = cachedEmailHistory.filter((email) => !email.lastLoginAt || Number(email.quotaUsed || 0) <= 0);
  const noLogin = cachedEmailHistory.filter((email) => !email.lastLoginAt);
  const firstCare = needsFollowUp[0] || null;
  const flow = sequenceFlowFilter?.value || 'pending';
  const flowLabel = getFlowLabel(flow);

  emailSentCount.textContent = cachedEmailHistory.length;
  emailNeedsFollowUp.textContent = needsFollowUp.length;
  emailNoLoginCount.textContent = noLogin.length;
  emailSequenceStepCount.textContent = sequenceRows.length;
  emailSequenceFlowLabel.textContent = flowLabel;
  emailPriorityTitle.textContent = `${needsFollowUp.length} khách cần nhắc`;
  emailPriorityText.textContent = firstCare
    ? `\u01afu ti\u00ean ${firstCare.customerName || firstCare.to || firstCare.orderCode}: ${getEmailRecommendedAction(firstCare)}`
    : 'Không có khách bị kẹt trong lịch sử email hiện tại.';
  emailSequenceTitle.textContent = `${sequenceRows.length} bước trong chuỗi ${flowLabel}`;
  emailSequenceText.textContent = getWorkflowDescription(flow);
};

const renderPendingPayments = (orders) => {
  const pendingOrders = (orders || [])
    .filter((order) => order.status === 'pending_payment')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  if (pendingPaymentCount) {
    pendingPaymentCount.textContent = `${pendingOrders.length} đơn chờ xử lý`;
  }

  if (!pendingOrders.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'muted-text empty-cell';
    cell.textContent = 'Không có đơn chờ thanh toán.';
    row.append(cell);
    pendingPaymentsBody.replaceChildren(row);
    return;
  }

  pendingPaymentsBody.replaceChildren(...pendingOrders.map((order) => {
    const row = document.createElement('tr');
    appendTextCell(row, formatDate(order.createdAt));
    appendTextCell(row, order.customerName || '-');
    appendTextCell(row, order.phone || '-');
    appendTextCell(row, order.email || '-', 'email-cell');
    appendTextCell(row, order.transferContent || order.code || '-', 'email-cell');
    appendTextCell(row, order.planName || '-');
    appendTextCell(row, formatMoney(order.price));
    appendTextCell(row, getPendingPaymentCareAction(order), 'prompt-cell');
    return row;
  }));
};

const renderWorkflowTabs = (activeFlow, rows) => {
  if (!workflowTabs) return;
  workflowTabs.replaceChildren(...workflowOrder.map((flow) => {
    const meta = workflowMeta[flow];
    const count = getEmailWorkflowRows(flow).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'workflow-tab ' + meta.tone + (flow === activeFlow ? ' active' : '');
    button.innerHTML = '<strong>' + meta.short + '</strong><span>' + count + ' b\u01b0\u1edbc</span>';
    button.addEventListener('click', () => {
      sequenceFlowFilter.value = flow;
      renderEmailSequences();
    });
    return button;
  }));
};

const renderWorkflowInsight = (flow, rows) => {
  if (!workflowInsight) return;
  const meta = workflowMeta[flow] || workflowMeta.trial;
  const first = rows[0];
  const last = rows[rows.length - 1];
  workflowInsight.className = 'workflow-insight ' + meta.tone;
  workflowInsight.innerHTML = '<div><span>Workflow \u0111ang xem</span><strong>' + meta.label + '</strong><p>' + meta.description + '</p></div>'
    + '<dl><div><dt>S\u1ed1 b\u01b0\u1edbc</dt><dd>' + rows.length + '</dd></div>'
    + '<div><dt>B\u1eaft \u0111\u1ea7u</dt><dd>' + (first ? 'Ng\u00e0y ' + first.day : '-') + '</dd></div>'
    + '<div><dt>K\u1ebft th\u00fac</dt><dd>' + (last ? 'Ng\u00e0y ' + last.day : '-') + '</dd></div></dl>';
};

const renderEmailSequences = () => {
  const flow = sequenceFlowFilter?.value || 'pending';
  const rows = getEmailWorkflowRows(flow);
  const flowLabel = getFlowLabel(flow);

  if (sequenceCount) {
    sequenceCount.textContent = rows.length + ' b\u01b0\u1edbc';
  }
  renderWorkflowTabs(flow, rows);
  renderWorkflowInsight(flow, rows);

  sequenceBody.replaceChildren(...rows.map((item) => {
    const row = document.createElement('tr');
    row.className = 'workflow-row ' + (workflowMeta[flow]?.tone || '');
    const dayCell = appendTextCell(row, 'Ng\u00e0y ' + item.day);
    dayCell.className = 'workflow-day-cell';
    appendTextCell(row, item.stage || '-');
    appendTextCell(row, item.trigger || '-', 'prompt-cell');
    appendTextCell(row, item.subject || '-', 'prompt-cell');
    appendTextCell(row, item.goal || '-', 'prompt-cell');
    appendTextCell(row, item.action || '-', 'prompt-cell');
    return row;
  }));
  renderEmailCenterSummary(rows);
};

const renderAgentInsights = () => {
  const lowQuota = cachedUsers.filter((user) => user.role !== 'admin' && Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0)) <= 5);
  const expiring = cachedUsers.filter((user) => {
    const daysLeft = getDaysLeft(user.expiresAt);
    return user.role !== 'admin' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
  });
  const inactive = cachedUsers.filter((user) => user.role !== 'admin' && !user.activatedAt && user.status === 'active');
  const recentFailures = cachedEvents.filter((event) => !event.ok).slice(0, 5);
  const items = [
    { level: lowQuota.length ? 'warning' : 'ok', title: 'Quota thấp', text: lowQuota.length ? `${lowQuota.length} tài khoản còn từ 5 ảnh trở xuống.` : 'Quota thành viên đang ổn.' },
    { level: expiring.length ? 'warning' : 'ok', title: 'Sắp hết hạn', text: expiring.length ? `${expiring.length} tài khoản hết hạn trong 3 ngày tới.` : 'Chưa có tài khoản sắp hết hạn.' },
    { level: inactive.length ? 'info' : 'ok', title: 'Chưa kích hoạt', text: inactive.length ? `${inactive.length} tài khoản đã cấp nhưng thành viên chưa dùng lần đầu.` : 'Tài khoản đã cấp đều đã có hoạt động.' },
    { level: recentFailures.length ? 'danger' : 'ok', title: 'Lỗi gần đây', text: recentFailures.length ? `${recentFailures.length} lỗi mới nhất cần kiểm tra trong lịch sử tạo ảnh.` : 'Không có lỗi mới trong danh sách gần đây.' }
  ];

  agentInsights.replaceChildren(...items.map((item) => {
    const card = document.createElement('article');
    card.className = `insight ${item.level}`;
    card.innerHTML = `<strong>${item.title}</strong><span>${item.text}</span>`;
    return card;
  }));
};

const loadRouterQuota = async () => {
  try {
    const quota = await api(`${ADMIN_API}/router-quota`);
    const remaining = quota.quotaRemaining == null ? '-' : Number(quota.quotaRemaining).toLocaleString('vi-VN');
    const total = quota.quotaTotal == null ? '' : ` / ${Number(quota.quotaTotal).toLocaleString('vi-VN')}`;
    document.querySelector('#statRouterQuota').textContent = `${remaining}${total}`;
    document.querySelector('#routerQuotaSource').textContent = quota.source === '9router' ? 'Theo 9Router' : 'Theo cấu hình/backend';
  } catch (error) {
    document.querySelector('#statRouterQuota').textContent = '-';
    document.querySelector('#routerQuotaSource').textContent = error.message;
  }
};

const loginAdmin = async ({ email, password }) => {
  const result = await api(`${USER_API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      deviceId: `web-admin-${navigator.userAgent.slice(0, 80)}`
    })
  });

  if (result.user?.role !== 'admin') {
    throw new Error('Tài khoản này không có quyền admin.');
  }

  if (result.requiresTwoFactor || result.requiresTwoFactorSetup) {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    showTwoFactorFlow(result);
    return null;
  }

  token = result.token;
  currentAdmin = result.user;
  localStorage.setItem('adminToken', token);
  resetTwoFactorFlow();
  return result.user;
};

const verifyTwoFactor = async () => {
  if (!pendingTwoFactor?.tempToken) {
    throw new Error('Vui lòng đăng nhập lại để xác thực 2FA.');
  }

  const code = twoFactorCode.value.replace(/\D/g, '');
  if (code.length !== 6) {
    throw new Error('Nhập mã 2FA gồm 6 số.');
  }

  const result = await api(`${USER_API}/auth/2fa/verify`, {
    method: 'POST',
    body: JSON.stringify({
      tempToken: pendingTwoFactor.tempToken,
      code,
      deviceId: `web-admin-${navigator.userAgent.slice(0, 80)}`
    })
  });

  token = result.token;
  currentAdmin = result.user;
  localStorage.setItem('adminToken', token);
  resetTwoFactorFlow();
  return result.user;
};

const loadCurrentAdmin = async () => {
  if (!token) return null;
  const result = await api(`${USER_API}/auth/me`);
  if (result.user?.role !== 'admin') {
    throw new Error('Token hiện tại không có quyền admin.');
  }
  currentAdmin = result.user;
  return result.user;
};

const loadDashboard = async () => {
  const [stats, users, events, orders, emailHistory] = await Promise.all([
    api(`${ADMIN_API}/stats`),
    api(`${ADMIN_API}/users`),
    api(`${ADMIN_API}/events?limit=200`),
    api(`${ADMIN_API}/orders?limit=500`),
    api(`${ADMIN_API}/email-history?limit=300`)
  ]);

  cachedUsers = users.users || [];
  cachedEvents = events.events || [];
  cachedOrders = orders.orders || [];
  cachedEmailHistory = emailHistory.emails || [];
  setLoggedIn(true, currentAdmin);
  document.querySelector('#statUsers').textContent = stats.users;
  document.querySelector('#statImages').textContent = `${stats.imagesCreated} ảnh đã tạo`;
  document.querySelector('#statToday').textContent = stats.imagesToday;
  document.querySelector('#statFailures').textContent = stats.failures;
  document.querySelector('#lastUpdated').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
  renderDashboardSummary();
  renderUsers();
  renderEvents(cachedEvents);
  renderPendingPayments(cachedOrders);
  renderEmailHistory(cachedEmailHistory);
  renderEmailSequences();
  renderAgentInsights();
  await loadRouterQuota();
};

const updateUser = async (id, changes) => {
  await api(`${ADMIN_API}/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
  await loadDashboard();
};

document.querySelectorAll('.preset').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#newQuota').value = button.dataset.quota;
    document.querySelector('#newDurationDays').value = button.dataset.days;
    document.querySelector('#newDeviceLimit').value = button.dataset.devices;
    activePlanFilter = activePlanFilter === button.dataset.plan ? 'all' : button.dataset.plan;
    roleFilter.value = 'user';
    renderUsers();
  });
});

[userSearch, statusFilter, roleFilter].forEach((control) => {
  control.addEventListener('input', renderUsers);
  control.addEventListener('change', renderUsers);
});

sequenceFlowFilter?.addEventListener('change', renderEmailSequences);

document.querySelectorAll('.nav-action').forEach((button) => {
  button.addEventListener('click', () => {
    const tabTarget = button.dataset.tabTarget || '';
    if (tabTarget) {
      switchAdminTab(tabTarget);
    }

    const scrollTarget = button.dataset.scrollTarget || tabTarget;
    window.requestAnimationFrame(() => {
      const target = document.querySelector(scrollTarget || '');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

resetRenderOpsButton?.addEventListener('click', () => {
  renderOpsResetAt = new Date().toISOString();
  localStorage.setItem('renderOpsResetAt', renderOpsResetAt);
  renderDashboardSummary();
});

adminLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Đang đăng nhập...';

  try {
    const user = await loginAdmin({ email: emailInput.value.trim(), password: passwordInput.value });
    passwordInput.value = '';
    if (user) {
      loginStatus.textContent = '';
      await loadDashboard();
    } else {
      loginStatus.textContent = pendingTwoFactor?.setup
        ? 'Quét/thêm khóa 2FA rồi nhập mã 6 số để hoàn tất.'
        : 'Nhập mã 2FA để vào trang quản trị.';
    }
  } catch (error) {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    loginStatus.textContent = error.message;
  }
});

verifyTwoFactorButton.addEventListener('click', async () => {
  verifyTwoFactorButton.disabled = true;
  loginStatus.textContent = 'Đang xác thực 2FA...';

  try {
    await verifyTwoFactor();
    loginStatus.textContent = '';
    await loadDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
    verifyTwoFactorButton.disabled = false;
  }
});

twoFactorCode.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    verifyTwoFactorButton.click();
  }
});

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  createStatus.textContent = 'Đang thêm...';

  try {
    await api(`${ADMIN_API}/users`, {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#newEmail').value.trim(),
        password: document.querySelector('#newPassword').value,
        quotaTotal: Number(document.querySelector('#newQuota').value || 0),
        durationDays: Number(document.querySelector('#newDurationDays').value || 0),
        expiresAt: document.querySelector('#newExpiresAt').value || null,
        deviceLimit: Number(document.querySelector('#newDeviceLimit').value || 1),
        planName: activePlanFilter !== 'all' ? planLabels[activePlanFilter] : undefined,
        role: document.querySelector('#newRole').value
      })
    });
    createUserForm.reset();
    document.querySelector('#newQuota').value = 100;
    document.querySelector('#newDurationDays').value = 30;
    document.querySelector('#newDeviceLimit').value = 1;
    createStatus.textContent = 'Đã thêm tài khoản.';
    await loadDashboard();
  } catch (error) {
    createStatus.textContent = error.message;
  }
});

logoutButton.addEventListener('click', () => {
  token = '';
  currentAdmin = null;
  localStorage.removeItem('adminToken');
  resetTwoFactorFlow();
  setLoggedIn(false);
});

refreshButton.addEventListener('click', () => {
  refreshButton.disabled = true;
  loadDashboard()
    .catch((error) => { adminEmail.textContent = error.message; })
    .finally(() => { refreshButton.disabled = false; });
});

setLoggedIn(false);
resetTwoFactorFlow();
loadCurrentAdmin()
  .then((user) => user ? loadDashboard() : null)
  .catch(() => {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    resetTwoFactorFlow();
    setLoggedIn(false);
  });
