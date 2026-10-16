#!/usr/bin/env bash
# 구글 클라우드 예산을 넘으면 구글 장소 API를 자동으로 끄는 장치(결제는 끊지 않음).
#
# 어떻게 동작하나
#   구글 예산 → (알림 메시지) Pub/Sub 주제 → Cloud Function → 이번 달 청구액이 예산 이상이면
#   이 프로젝트의 장소 관련 API(places, places-backend, maps-backend)를 '사용 중지'한다.
#   결제 계정을 끊지 않으므로 프로젝트·키·설정은 그대로 남고, 다시 켜면 바로 돌아온다.
#
# 쓰는 법(한 번만)
#   1) console.cloud.google.com 오른쪽 위 '>_'(Cloud Shell)를 열고 지도 키가 있는 프로젝트를 고른다.
#   2) 이 파일 내용을 붙여 넣어 실행한다:  bash stop-places-on-budget.sh
#   3) 결제 → 예산 및 알림 → 쓰고 있는 예산 → '알림 관리'에서
#      'Pub/Sub 주제를 이 예산에 연결'을 켜고, 이 스크립트가 만든 주제(places-budget-stop)를 고른다.
#      (권한을 주겠냐고 물으면 허용)
#   4) 시험: 끝에 출력되는 '시험해 보기' 명령을 실행하면 실제로 꺼진다 → '다시 켜기' 명령으로 되돌린다.
#
# 알아 둘 점
#   - 구글 예산 금액은 몇 시간 늦게 반영된다. 그 사이에 쓴 요금은 막지 못한다(PinWith 운영자 콘솔의
#     '예산 넘으면 자동으로 끄기'가 더 빨리 반응하니 둘 다 켜 두세요).
#   - 예산의 범위(프로젝트·서비스)가 넓으면 다른 서비스 요금 때문에 꺼질 수도 있다. 예산 범위를 이 프로젝트로 두세요.
#   - 달이 바뀌면 자동으로 켜지지 않는다. 아래 '다시 켜기' 명령을 실행하세요.
set -euo pipefail
echo "스크립트 판: 5 (권한 반영을 기다리며 다시 시도)"

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-northeast3}"   # 서울
TOPIC="places-budget-stop"
FN="stop-places-on-budget"
SA_NAME="places-budget-stop"
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
[ -n "$PROJECT" ] || { echo "프로젝트를 먼저 고르세요: gcloud config set project <프로젝트ID>"; exit 1; }
echo "프로젝트: $PROJECT / 지역: $REGION"

# 끌 API: 지금 켜져 있는 것 중 장소 관련만
SERVICES="$(gcloud services list --enabled --project "$PROJECT" --format='value(config.name)' \
  | grep -E '^(places|places-backend|maps-backend)\.googleapis\.com$' | paste -sd, - || true)"
[ -n "$SERVICES" ] || { echo "켜진 장소 API를 찾지 못했어요. 프로젝트가 맞는지 확인하세요."; exit 1; }
echo "예산을 넘으면 끌 API: $SERVICES"

gcloud services enable --project "$PROJECT" \
  cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com eventarc.googleapis.com \
  pubsub.googleapis.com serviceusage.googleapis.com artifactregistry.googleapis.com

gcloud pubsub topics describe "$TOPIC" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud pubsub topics create "$TOPIC" --project "$PROJECT"

gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" --display-name "예산 넘으면 장소 API 끄기"
# API를 켜고 끄는 권한, 그리고 Pub/Sub 메시지로 함수를 부르는 권한
# 함수를 빌드하는 권한도 이 계정에 준다(새 프로젝트는 기본 빌드 계정에 권한이 없어 빌드가 실패함)
for ROLE in roles/serviceusage.serviceUsageAdmin roles/run.invoker roles/eventarc.eventReceiver \
            roles/cloudbuild.builds.builder roles/logging.logWriter roles/artifactregistry.writer roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$ROLE" --condition=None >/dev/null
done

echo "권한이 퍼지도록 30초 기다려요…"; sleep 30
SRC="$(mktemp -d)"
cat > "$SRC/requirements.txt" <<'REQ'
functions-framework==3.*
google-auth==2.*
requests==2.*
REQ
cat > "$SRC/main.py" <<'PY'
import base64, json, os
import functions_framework
import google.auth
from google.auth.transport.requests import AuthorizedSession

PROJECT = os.environ["PROJECT"]
SERVICES = [s for s in os.environ["SERVICES"].split(",") if s]

@functions_framework.cloud_event
def stop(event):
    msg = json.loads(base64.b64decode(event.data["message"]["data"]))
    cost = float(msg.get("costAmount", 0))
    budget = float(msg.get("budgetAmount", 0))
    print(f"budget {msg.get('budgetDisplayName')}: cost {cost} / budget {budget} {msg.get('currencyCode')}")
    if budget <= 0 or cost < budget:
        return
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    s = AuthorizedSession(creds)
    for name in SERVICES:
        r = s.post(
            f"https://serviceusage.googleapis.com/v1/projects/{PROJECT}/services/{name}:disable",
            json={"disableDependentServices": False, "checkIfServiceHasUsage": "SKIP"},
        )
        print(f"disable {name}: {r.status_code} {r.text[:200]}")
PY

# 환경 변수는 파일로 넘긴다(SERVICES 값의 쉼표를 gcloud가 구분 기호로 읽지 않게)
printf 'PROJECT: "%s"\nSERVICES: "%s"\n' "$PROJECT" "$SERVICES" > "$SRC/.env.yaml"
# 함수 소스를 올려 두는 저장소(버킷)에도 읽기 권한을 직접 준다(있을 때만)
NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
BUCKET="gs://gcf-v2-sources-${NUM}-${REGION}"
if gcloud storage buckets describe "$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets add-iam-policy-binding "$BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectViewer >/dev/null
fi

# 새로 준 권한이 퍼지는 데 몇 분 걸릴 수 있어서, 권한 오류면 1분 쉬고 최대 5번 다시 시도한다
for TRY in 1 2 3 4 5; do
  if gcloud functions deploy "$FN" --project "$PROJECT" --gen2 --region "$REGION" --runtime python312 \
    --source "$SRC" --entry-point stop --trigger-topic "$TOPIC" \
    --service-account "$SA" --trigger-service-account "$SA" \
    --build-service-account "projects/$PROJECT/serviceAccounts/$SA" \
    --env-vars-file "$SRC/.env.yaml" --max-instances 1 --memory 256Mi --quiet; then
    break
  fi
  [ "$TRY" = 5 ] && { echo "배포가 계속 실패해요. 위 오류 내용을 Claude에게 보내 주세요."; exit 1; }
  echo "배포 실패($TRY/5). 권한이 아직 퍼지지 않았을 수 있어요. 1분 뒤 다시 시도해요…"; sleep 60
done

TEST_DATA="$(printf '{"budgetDisplayName":"test","costAmount":2,"budgetAmount":1,"currencyCode":"USD"}')"
cat <<MSG

완료. 남은 일: 결제 → 예산 및 알림 → 예산 → '알림 관리'에서 Pub/Sub 주제 '$TOPIC'를 연결하세요.

시험해 보기(실제로 장소 API가 꺼져요):
  gcloud pubsub topics publish $TOPIC --project $PROJECT --message '$TEST_DATA'
  (1~2분 뒤) gcloud services list --enabled --project $PROJECT | grep -E 'places|maps-backend'   # 안 보이면 꺼진 것
  기록 보기: gcloud functions logs read $FN --project $PROJECT --region $REGION --gen2 --limit 20

다시 켜기:
  gcloud services enable --project $PROJECT ${SERVICES//,/ }

장치 없애기:
  gcloud functions delete $FN --project $PROJECT --region $REGION --gen2 --quiet && gcloud pubsub topics delete $TOPIC --project $PROJECT
MSG
