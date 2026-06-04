# -*- coding: utf-8 -*-
"""
crawl_google_maps_reviews_to_txt.py

Crawler review Google Maps cho ReviewHub.
- Dùng chung cho nhà xe, khách sạn, tàu hỏa, máy bay, tour.
- Hỗ trợ rating Google Maps dạng:
  + "5 sao", "4 sao"
  + "5 stars"
  + "5/5", "4/5" cho một số khách sạn
- Output: scripts/google_maps_reviews.txt
- Mỗi dòng là 1 JSON review để import bằng import_reviews_from_txt.js

Bản này sửa lỗi:
- Không tự tạo TEMP-001.
- Match được "khach san Vinpearl Resort Nha Trang" với KS-002.
- Không xóa chữ "resort" khỏi keyword nữa.
- Có token match: keyword "vinpearl nha trang" vẫn match được "Vinpearl Resort Nha Trang".
"""

import sys
import io
import os
import re
import json
import time
import random
from datetime import datetime, timezone

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass


SEARCH_KEYWORD = sys.argv[1] if len(sys.argv) > 1 else "Phương Trang"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

OUTPUT_FILE = os.path.join(BASE_DIR, "google_maps_reviews.txt")

SEED_OPERATORS_FILE = os.path.join(BASE_DIR, "seed-operators.js")

SOURCE_SYSTEM = "google-maps"

MAX_REVIEWS = 200


def clean_text(text):
    if not text:
        return ""

    return re.sub(r"\s+", " ", str(text)).strip()


def normalize_text(value):
    text = str(value or "").lower().strip()
    text = text.replace("đ", "d")
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_compact(value):
    return re.sub(r"[^a-z0-9]+", "", normalize_text(value))


def tokenize(value):
    return [
        token
        for token in re.split(r"[^a-z0-9]+", normalize_text(value))
        if token
    ]


def now_iso():
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def moderation_status(rating=None, comment=None):
    return "pending_review"


def rating_to_number(text):
    if not text:
        return 0

    text = str(text).strip()

    # Khách sạn: 5/5, 4/5...
    match = re.search(r"([1-5])\s*/\s*5", text)

    if match:
        return int(match.group(1))

    # Tiếng Việt: 5 sao, 4 sao...
    match = re.search(r"([1-5])\s*sao", text, re.IGNORECASE)

    if match:
        return int(match.group(1))

    # Tiếng Anh: 5 stars, 4 stars...
    match = re.search(r"([1-5])\s*star", text, re.IGNORECASE)

    if match:
        return int(match.group(1))

    # Fallback
    match = re.search(r"([1-5])(?:[,.]0)?", text)

    if match:
        return int(match.group(1))

    return 0


def extract_review_count_from_label(label):
    if not label:
        return 0

    label = str(label).replace(".", "").replace(",", "")

    match = re.search(r"(\d+)\s*bài đánh giá", label, re.IGNORECASE)

    if match:
        return int(match.group(1))

    match = re.search(r"(\d+)\s*reviews?", label, re.IGNORECASE)

    if match:
        return int(match.group(1))

    return 0


def load_operators_from_seed():
    if not os.path.exists(SEED_OPERATORS_FILE):
        raise Exception(f"Không tìm thấy file {SEED_OPERATORS_FILE}")

    with open(SEED_OPERATORS_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r"\{\s*code:\s*['\"]([^'\"]+)['\"]\s*,\s*name:\s*['\"]([^'\"]+)['\"]"

    matches = re.findall(pattern, content)

    operators = []

    for code, name in matches:
        operators.append({
            "operatorCode": code.strip(),
            "operatorName": name.strip()
        })

    if not operators:
        raise Exception("Không đọc được operator nào trong seed-operators.js")

    return operators


def remove_service_words(keyword):
    text = normalize_text(keyword)

    # Cố tình KHÔNG xóa "resort", vì tên seed có "Vinpearl Resort Nha Trang".
    remove_words = [
        "nha xe",
        "nhà xe",
        "xe khach",
        "xe khách",
        "ben xe",
        "bến xe",
        "khach san",
        "khách sạn",
        "hotel",
        "khu nghi duong",
        "khu nghỉ dưỡng",
        "hang bay",
        "hãng bay",
        "may bay",
        "máy bay",
        "tau hoa",
        "tàu hỏa",
        "tour",
    ]

    for word in remove_words:
        text = text.replace(normalize_text(word), "")

    return clean_text(text)


def find_operator(search_keyword):
    operators = load_operators_from_seed()

    raw_keyword = str(search_keyword or "").strip()
    keyword = normalize_text(raw_keyword)
    clean_keyword = remove_service_words(raw_keyword)

    print("DEBUG FIND OPERATOR")
    print(f"Seed file     : {SEED_OPERATORS_FILE}")
    print(f"Raw keyword   : {raw_keyword}")
    print(f"Clean keyword : {clean_keyword}")

    # 1. Match đúng tên
    for op in operators:
        op_name = normalize_text(op["operatorName"])

        if op_name == clean_keyword:
            print(f"✓ Match exact: {op['operatorCode']} - {op['operatorName']}")
            return op

    # 2. Match keyword nằm trong tên
    for op in operators:
        op_name = normalize_text(op["operatorName"])

        if clean_keyword and clean_keyword in op_name:
            print(f"✓ Match keyword in operator: {op['operatorCode']} - {op['operatorName']}")
            return op

    # 3. Match tên nằm trong keyword
    for op in operators:
        op_name = normalize_text(op["operatorName"])

        if op_name and op_name in clean_keyword:
            print(f"✓ Match operator in keyword: {op['operatorCode']} - {op['operatorName']}")
            return op

    # 4. Match theo code
    for op in operators:
        op_code = normalize_text(op["operatorCode"])

        if op_code == clean_keyword or op_code == keyword:
            print(f"✓ Match code: {op['operatorCode']} - {op['operatorName']}")
            return op

    # 5. Compact match
    compact_keyword = normalize_compact(clean_keyword)

    for op in operators:
        compact_name = normalize_compact(op["operatorName"])

        if compact_keyword and (compact_keyword in compact_name or compact_name in compact_keyword):
            print(f"✓ Match compact: {op['operatorCode']} - {op['operatorName']}")
            return op

    # 6. Token match: mọi token quan trọng của keyword có trong tên seed.
    # Ví dụ: "vinpearl nha trang" match "vinpearl resort nha trang".
    keyword_tokens = tokenize(clean_keyword)
    stop_tokens = {"hotel", "khach", "san", "nha", "xe", "the", "and"}
    keyword_tokens = [token for token in keyword_tokens if token not in stop_tokens]

    best = None
    best_score = 0

    for op in operators:
        name_tokens = set(tokenize(op["operatorName"]))

        if not keyword_tokens:
            continue

        matched = [token for token in keyword_tokens if token in name_tokens]
        score = len(matched) / max(len(keyword_tokens), 1)

        if score > best_score:
            best = op
            best_score = score

    if best and best_score >= 0.67:
        print(f"✓ Match token {best_score:.2f}: {best['operatorCode']} - {best['operatorName']}")
        return best

    print("")
    print("KHÔNG TÌM THẤY TRONG seed-operators.js")
    print("Kiểm tra xem file script đang đọc có đúng file bạn vừa sửa không.")
    print(f"Seed file đang đọc: {SEED_OPERATORS_FILE}")
    print("Một số tên đang có trong seed:")
    for op in operators[:80]:
        print(f"- {op['operatorCode']} - {op['operatorName']}")
    print("")

    raise Exception(
        f"Không tìm thấy '{search_keyword}' trong seed-operators.js. "
        f"Hãy nhập đúng tên trong seed, ví dụ: Vinpearl Resort Nha Trang. "
        f"Không import bằng TEMP-001 để tránh review không hiện trên frontend."
    )


selected_operator = find_operator(SEARCH_KEYWORD)

OPERATOR_CODE = selected_operator["operatorCode"]

TARGET_NAME = selected_operator["operatorName"]

OWNER_PARTNER_CODE = OPERATOR_CODE


def build_category_and_target_code(operator_code):
    if operator_code.startswith("KS-"):
        return "Khách sạn", f"HOTEL-{operator_code.replace('KS-', '')}-001"

    if operator_code.startswith("PT-"):
        return "Nhà xe", f"BUS-{operator_code.replace('PT-', '')}-001"

    if operator_code.startswith("TH-"):
        return "Tàu hỏa", f"TRAIN-{operator_code.replace('TH-', '')}-001"

    if operator_code.startswith("MB-"):
        return "Máy bay", f"AIR-{operator_code.replace('MB-', '')}-001"

    if operator_code.startswith("TO-"):
        return "Tour", f"TOUR-{operator_code.replace('TO-', '')}-001"

    if operator_code.startswith("DV-"):
        return "Dịch vụ", f"SERVICE-{operator_code.replace('DV-', '')}-001"

    return "Dịch vụ", f"SERVICE-{operator_code}-001"


CATEGORY_NAME, TARGET_CODE = build_category_and_target_code(OPERATOR_CODE)


print("====================================")
print("DỊCH VỤ ĐANG CRAWL")
print(f"Search keyword : {SEARCH_KEYWORD}")
print(f"Category       : {CATEGORY_NAME}")
print(f"Operator code  : {OPERATOR_CODE}")
print(f"Target code    : {TARGET_CODE}")
print(f"Target name    : {TARGET_NAME}")
print(f"MAX REVIEWS    : {MAX_REVIEWS}")
print("Moderation     : pending_review")
print("Visibility     : hidden")
print("====================================")


def setup_driver():
    options = webdriver.ChromeOptions()

    options.add_argument("--start-maximized")
    options.add_argument("--lang=vi-VN")
    options.add_argument("--disable-blink-features=AutomationControlled")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )

    return driver


def search_place(driver):
    driver.get("https://www.google.com/maps")

    wait = WebDriverWait(driver, 30)

    search_input = wait.until(
        EC.presence_of_element_located(
            (By.XPATH, "//input[@role='combobox']")
        )
    )

    search_input.clear()
    search_input.send_keys(SEARCH_KEYWORD)

    time.sleep(1)

    search_input.send_keys(Keys.ENTER)

    time.sleep(7)

    print("Đang chọn kết quả có nhiều bài đánh giá nhất...")

    result_cards = driver.find_elements(
        By.XPATH,
        "//div[@role='article' and contains(@class,'Nv2PK')]"
    )

    print(f"DEBUG: Tìm thấy {len(result_cards)} card result")

    if not result_cards:
        print("Không thấy danh sách card. Có thể Google Maps đã mở thẳng địa điểm.")
        time.sleep(4)
        return

    best_card = None
    best_review_count = -1
    best_name = ""

    for card in result_cards:
        try:
            name = card.find_element(
                By.XPATH,
                ".//div[contains(@class,'qBF1Pd')]"
            ).text
        except Exception:
            name = ""

        aria_label = ""

        rating_xpaths = [
            ".//span[@role='img' and contains(@aria-label,'bài đánh giá')]",
            ".//span[@role='img' and contains(@aria-label,'reviews')]",
            ".//span[contains(@aria-label,'bài đánh giá')]",
            ".//span[contains(@aria-label,'reviews')]",
            ".//*[contains(text(),'bài đánh giá')]",
            ".//*[contains(text(),'reviews')]",
        ]

        for xpath in rating_xpaths:
            try:
                rating_el = card.find_element(By.XPATH, xpath)
                aria_label = (
                    rating_el.get_attribute("aria-label")
                    or rating_el.get_attribute("title")
                    or rating_el.text
                    or ""
                )

                if aria_label:
                    break
            except Exception:
                pass

        review_count = extract_review_count_from_label(aria_label)

        print(f"- {name}: {review_count} reviews")

        if review_count > best_review_count:
            best_review_count = review_count
            best_card = card
            best_name = name

    if not best_card:
        print("Không tìm thấy kết quả phù hợp")
        return

    print("\n====================================")
    print("ĐÃ CHỌN")
    print(best_name)
    print(f"{best_review_count} reviews")
    print("====================================\n")

    clicked = False

    link_xpaths = [
        ".//a[contains(@class,'hfpxzc')]",
        ".//a[contains(@href,'/maps/place')]",
        ".//a[contains(@href,'google.com/maps')]",
        ".//a[@href]",
    ]

    for xpath in link_xpaths:
        try:
            link = best_card.find_element(By.XPATH, xpath)

            driver.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});",
                link
            )

            time.sleep(1)

            driver.execute_script(
                "arguments[0].click();",
                link
            )

            clicked = True

            print("Đã click vào link địa điểm.")

            break
        except Exception:
            pass

    if not clicked:
        try:
            driver.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});",
                best_card
            )

            time.sleep(1)

            driver.execute_script(
                "arguments[0].click();",
                best_card
            )

            clicked = True

            print("Không thấy link, đã click trực tiếp vào card.")
        except Exception as error:
            print("Không click được card kết quả.")
            print(str(error))

    if not clicked:
        try:
            name_el = best_card.find_element(
                By.XPATH,
                ".//div[contains(@class,'qBF1Pd')]"
            )

            driver.execute_script(
                "arguments[0].click();",
                name_el
            )

            clicked = True

            print("Đã click vào tên địa điểm.")
        except Exception as error:
            print("Không click được tên địa điểm.")
            print(str(error))

    if not clicked:
        raise Exception(
            "Không thể mở địa điểm Google Maps. Có thể giao diện Google Maps đã đổi hoặc kết quả không có link."
        )

    time.sleep(7)


def click_review_tab(driver):
    wait = WebDriverWait(driver, 30)

    review_xpaths = [
        "//button[@role='tab' and contains(@aria-label,'Bài đánh giá')]",
        "//button[@role='tab' and contains(.,'Bài đánh giá')]",
        "//button[contains(@aria-label,'Bài đánh giá')]",
        "//button[contains(.,'Bài đánh giá')]",
        "//button[@role='tab' and contains(@aria-label,'Reviews')]",
        "//button[@role='tab' and contains(.,'Reviews')]",
        "//*[self::button or self::div][contains(.,'Bài đánh giá')]",
        "//*[self::button or self::div][contains(.,'Reviews')]",
    ]

    last_error = None

    for xpath in review_xpaths:
        try:
            review_tab = wait.until(
                EC.element_to_be_clickable((By.XPATH, xpath))
            )

            driver.execute_script("arguments[0].click();", review_tab)

            time.sleep(4)

            print("Đã mở tab Bài đánh giá.")

            return
        except Exception as error:
            last_error = error

    raise Exception(f"Không mở được tab Bài đánh giá: {last_error}")


def expand_more_buttons(driver):
    button_xpaths = [
        "//button[contains(text(),'Thêm')]",
        "//button[contains(text(),'More')]",
        "//button[contains(@aria-label,'Xem thêm')]",
        "//button[contains(@aria-label,'More')]",
        "//button[contains(@aria-label,'Thêm')]",
        "//button[contains(@aria-label,'Đọc thêm')]",
    ]

    for xpath in button_xpaths:
        buttons = driver.find_elements(By.XPATH, xpath)

        for btn in buttons:
            try:
                driver.execute_script("arguments[0].click();", btn)
                time.sleep(0.12)
            except Exception:
                pass


def scroll_review_panel(driver):
    driver.execute_script("""
        const candidates = Array.from(document.querySelectorAll(
            'div[role="main"] div, div[role="feed"], div.m6QErb, div[aria-label]'
        ));

        const scrollables = candidates
            .filter(el => el && el.scrollHeight > el.clientHeight + 80)
            .sort((a, b) => b.scrollHeight - a.scrollHeight);

        const target = scrollables[0];

        if (target) {
            target.scrollTop = target.scrollHeight;
            target.dispatchEvent(new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: 1600
            }));
        }

        window.scrollBy(0, 900);
    """)


def extract_reviews(driver):
    reviews = []

    block_xpaths = [
        "//div[contains(@class,'jftiEf')]",
        "//div[@data-review-id]",
        "//div[contains(@aria-label,'sao') and ancestor::div[@data-review-id]]/ancestor::div[@data-review-id]",
        "//div[contains(@aria-label,'star') and ancestor::div[@data-review-id]]/ancestor::div[@data-review-id]",
        "//span[contains(text(),'/5')]/ancestor::div[contains(@class,'jftiEf') or @data-review-id][1]",
        "//span[contains(text(),'/5')]/ancestor::div[starts-with(@class,'GHT2ce') or contains(@class,'DU9Pgb')][1]/ancestor::div[1]",
    ]

    blocks = []

    for xpath in block_xpaths:
        try:
            found = driver.find_elements(By.XPATH, xpath)

            if found:
                blocks = found
                break
        except Exception:
            pass

    print(f"DEBUG: Tìm thấy {len(blocks)} review blocks")

    for block in blocks:
        reviewer_name = ""
        rating_text = ""
        comment = ""
        review_date = ""

        name_xpaths = [
            ".//div[contains(@class,'d4r55')]",
            ".//button[contains(@class,'WEBjve')]",
            ".//div[contains(@class,'WNxzHc')]",
            ".//*[contains(@aria-label,'Ảnh của')]/ancestor::div[2]//div",
            ".//a[contains(@class,'WNxzHc')]",
            ".//div[contains(@class,'fontHeadlineSmall')]",
        ]

        rating_xpaths = [
            ".//span[contains(@class,'kvMYJc')]",
            ".//span[contains(@aria-label,'sao')]",
            ".//span[contains(@aria-label,'star')]",
            ".//*[@role='img' and contains(@aria-label,'sao')]",
            ".//*[@role='img' and contains(@aria-label,'star')]",
            ".//span[contains(@class,'fzvQIb')]",
            ".//span[contains(@class,'fontBodyLarge') and contains(text(),'/5')]",
            ".//*[contains(text(),'/5')]",
        ]

        date_xpaths = [
            ".//span[contains(@class,'rsqaWe')]",
            ".//span[contains(text(),'trước')]",
            ".//span[contains(text(),'ago')]",
            ".//span[contains(text(),'tuần')]",
            ".//span[contains(text(),'tháng')]",
            ".//span[contains(text(),'năm')]",
        ]

        comment_xpaths = [
            ".//span[contains(@class,'wiI7pd')]",
            ".//div[contains(@class,'MyEned')]//span",
            ".//span[@lang]",
            ".//div[contains(@class,'MyEned')]",
            ".//div[contains(@class,'review-full-text')]",
        ]

        for xpath in name_xpaths:
            try:
                value = block.find_element(By.XPATH, xpath).text
                value = clean_text(value)

                if value:
                    reviewer_name = value
                    break
            except Exception:
                pass

        for xpath in rating_xpaths:
            try:
                el = block.find_element(By.XPATH, xpath)

                value = (
                    el.get_attribute("aria-label")
                    or el.get_attribute("title")
                    or el.text
                    or el.get_attribute("innerText")
                    or ""
                )

                value = clean_text(value)

                if value:
                    rating_text = value
                    break
            except Exception:
                pass

        for xpath in date_xpaths:
            try:
                value = block.find_element(By.XPATH, xpath).text
                value = clean_text(value)

                if value:
                    review_date = value
                    break
            except Exception:
                pass

        for xpath in comment_xpaths:
            try:
                value = block.find_element(By.XPATH, xpath).text
                value = clean_text(value)

                if value:
                    comment = value
                    break
            except Exception:
                pass

        reviewer_name = clean_text(reviewer_name)
        comment = clean_text(comment)
        review_date = clean_text(review_date)
        rating = rating_to_number(rating_text)

        if reviewer_name or comment or rating:
            reviews.append({
                "reviewerName": reviewer_name or "Người dùng Google",
                "rating": rating,
                "comment": comment or "Người dùng chỉ để lại số sao, không có bình luận.",
                "googleDateText": review_date,
            })

    return reviews


def save_reviews_to_txt(reviews):
    seen = set()
    unique_reviews = []

    for r in reviews:
        key = (
            r.get("reviewerName", ""),
            r.get("rating", 0),
            r.get("comment", "")
        )

        if key in seen:
            continue

        seen.add(key)

        unique_reviews.append(r)

    unique_reviews = unique_reviews[:MAX_REVIEWS]

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for index, r in enumerate(unique_reviews, start=1):
            pure_number = (
                OPERATOR_CODE
                .replace("PT-", "")
                .replace("KS-", "")
                .replace("TH-", "")
                .replace("MB-", "")
                .replace("TO-", "")
                .replace("DV-", "")
            )

            review_id = f"GM-{pure_number}-{index:03d}"

            item = {
                "id": review_id,

                "operatorCode": OPERATOR_CODE,
                "operatorName": TARGET_NAME,
                "partnerCode": OPERATOR_CODE,
                "partnerName": TARGET_NAME,
                "ownerPartnerCode": OWNER_PARTNER_CODE,
                "assignedOperatorCode": OPERATOR_CODE,

                "category": CATEGORY_NAME,
                "targetCode": TARGET_CODE,
                "targetName": TARGET_NAME,

                "reviewerName": r.get("reviewerName", "Người dùng Google"),
                "rating": r.get("rating", 0),
                "comment": r.get("comment", ""),

                "visibility": "hidden",
                "sourceSystem": SOURCE_SYSTEM,
                "moderationStatus": moderation_status(
                    r.get("rating"),
                    r.get("comment")
                ),

                "createdAt": now_iso(),

                "rawPayload": {
                    "source": SOURCE_SYSTEM,
                    "googleDateText": r.get("googleDateText", ""),
                    "searchKeyword": SEARCH_KEYWORD,
                    "operatorCode": OPERATOR_CODE,
                    "operatorName": TARGET_NAME,
                    "category": CATEGORY_NAME,
                    "ratingRaw": r.get("rating", 0)
                }
            }

            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print("\n====================================")
    print("Đã tạo file TXT:")
    print(OUTPUT_FILE)
    print(f"Tổng review unique: {len(unique_reviews)}")
    print("Status: pending_review")
    print("Visibility: hidden")
    print("====================================")


def main():
    driver = setup_driver()

    try:
        print("Đang tìm địa điểm...")

        search_place(driver)

        print("Đang mở tab Bài đánh giá...")

        click_review_tab(driver)

        all_reviews = []

        last_count = 0
        same_count = 0

        print("Đang crawl reviews...\n")

        for i in range(35):
            expand_more_buttons(driver)

            reviews = extract_reviews(driver)

            all_reviews = reviews

            if len(all_reviews) >= MAX_REVIEWS:
                all_reviews = all_reviews[:MAX_REVIEWS]
                print(f"\nĐã đạt giới hạn {MAX_REVIEWS} reviews")
                break

            print(f"Scroll {i + 1}: {len(all_reviews)} reviews")

            scroll_review_panel(driver)

            time.sleep(random.uniform(3, 5))

            if len(all_reviews) == last_count:
                same_count += 1
            else:
                same_count = 0

            last_count = len(all_reviews)

            if same_count >= 8:
                print("\nKhông còn review mới.")
                break

        save_reviews_to_txt(all_reviews)

        print("\n====================================")
        print(f"TOTAL SAVED: {len(all_reviews[:MAX_REVIEWS])}")
        print("====================================")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
