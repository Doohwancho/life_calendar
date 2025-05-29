# A. 파일 구조 
## a-1. before
```bash
/Users/MyName/Documents/MyCalendarApp/
└── data/
    ├── daily/
    │   ├── 2025-05.json
    │   ├── 2026-01.json
    │   └── ... (다른 월별 데이터)
    ├── yearly/
    │   ├── 2025.json
    │   └── ... (다른 연도별 데이터)
    ├── manifest.json  <-- 전체 파일 목록
    └── settings.json
```

## a-2. after 
```bash
data/
├── 2025/
│   ├── 2025.json       # 2025년 전체 정보 (yearly)
│   ├── 2025-01.json    # 2025년 1월 정보 (daily)
│   ├── 2025-02.json
│   └── ... (2025-12.json 까지)
├── 2026/
│   ├── 2026.json
│   ├── 2026-01.json
│   └── ...
├── 2027/
│   └── ...
└── settings.json       
```

## a-3. daily json 
2025-05.json는 한달치 데이터가 모여있다. 
```json 
{
  "yearMonth": "2025-05",
  "dailyData": {
    "2025-06-01": {
        "timeBlock": {},
        "goalBlock": {},
        "scheduledTimelineTasks": [],
        "todos": [],
        "projectTodos":[],
        "routines":[],
        "diary":{}
    },
    "2025-06-02": [ ... ]
  },
  "colorPalette": [  // <- 변경된 내용만 여기에 저장!
    { "color": "#38adf5", "label": "Learn" }, // 색상이 다름
    { "color": "#ffffff", "label": "Rest" }
    // ... 6월 당시에만 적용된 특별한 색상들 ...
  ]
}
```

## a-4. yearly json 
```json 
{
    "year":2025,
    "labels": [],
    "events": [],
    "backlogTodos": [],
    "calendarCellTodos": []
}
```



# B. save 방식 

## b-1. all_save 
어짜피 1년치 데이터가 전부니,
main page에 데이터는 해당년도인 2025.json에, 메모리에 로드된 365일의 데이터를 월별로 모아서 2025-01.json ~ 2025-12.json로 저장(.zip file)


## b-2. partial_save
1. 데이터 변경될 때마다, yearly page든 daily page든 marked as dirty가 된다.
2. 부분저장하면 marked dirty된 페이지의 .json만 저장된다.
3. 해당 파일을 원래 파일에 덮어쓴다.


# C. load 방식 
## c-1. 파일 로드 사이즈가 너무 크면 crash한다!
핵심: 파일이 커서 모든 파일을 메모리에 올리질 않는다!
manifest.json에 파일 100개가 있다고, 이걸 다 올리지 않는다!

- ✅ 안전 구간 (수십 MB): 50MB ~ 100MB 미만의 데이터를 메모리에 올리는 것은 대부분의 최신 데스크톱 환경에서 큰 문제 없이 동작할 가능성이 높습니다.
- ⚠️ 주의 구간 (수백 MB): 100MB ~ 500MB 정도가 되면, 로딩 시 UI가 몇 초간 멈추거나(freeze) 사용성이 크게 저하될 수 있습니다. 메모리가 부족한 시스템에서는 브라우저가 다운될 수 있습니다.
- ⛔️ 위험 구간 (GB 단위): 500MB 이상의 데이터를 순수 JavaScript 객체로 메모리에 한 번에 올리려고 시도하면, 브라우저가 다운될 확률이 매우 높습니다.


## c-2. 부분만 올릴까?
메모리에 올리는 단위는 년단위가 좋을까? 2025.json하고 2025-01.json ~ 2025-12.json 다 올리는거지.

그리고 2026 으로 바꾸면, 기존에 올린거 다 내리고, 2026.json와 2026-01.json ~ 2026-12.json 다 올리는거지.

그러면 적정 올리는 크기가 ~100MB가 적당하다는데, 그것도 어느정도 니즈가 맞춰짐 


## c-3. 어떻게 load 하지?
- 2025년도 보고있는 상태에서 세이브하면, backup_2025.zip 파일을 생성 
- 이 ZIP 파일 안에는 2025/ 폴더 구조가 그대로 담겨 있습니다. 
- 사용자는 이 backup_2025.zip 파일을 자신의 컴퓨터에 다운로드하여 저장합니다.
- 데이터를 불러올 땐, 폴더를 선택하는게 아닌, 저 zip 파일을 로드한다. 
- 앱은 이 ZIP 파일을 받아 압축을 풀고, 그 안에 있는 2025/ 폴더의 내용물을 읽어서 메모리에 로드합니다.



# D. routing 
yearly calendar -> daily page 전환시, spa가 UIUX에 좋은데,
SPA library를 써야 하나? 
아니면 `window.onhashchange` 써야하나?



