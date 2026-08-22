//! Puantajin Excel'e aktarilmasi.
//!
//! Cikti dogrudan muhasebeye/insan kaynaklarina gidebilecek duzende olsun
//! istiyoruz: ustte kurumsal logolar ve baslik, altinda ozet, sonra sutun
//! genislikleri ayarlanmis ve basligi dondurulmus veri tablosu.

use axum::extract::{Query, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use chrono::{DateTime, Datelike, Local, NaiveDate, Timelike, Utc};
use rust_xlsxwriter::{
    Color, Format, FormatAlign, FormatBorder, Image, Workbook, Worksheet,
};

use crate::auth::CurrentUser;
use crate::error::{ApiError, ApiResult};
use crate::routes::attendance::{daily_rows, DailyQuery, DailySummary};
use crate::AppState;

/// Logolar derleme aninda binary'ye gomulur; calisma aninda dosya aramaya
/// gerek kalmaz ve container'a ayri bir birim baglanmasi gerekmez.
const LOGO_HOLDING: &[u8] = include_bytes!("../../assets/ern-holding.png");
const LOGO_TAAHHUT: &[u8] = include_bytes!("../../assets/ern-taahhut.png");

/// Logolarin sayfadaki hedef yuksekligi (piksel). Kaynak dosyalar 3500px
/// genisliginde; olcegi sabit vermek yerine goruntunun kendi boyutundan
/// hesapliyoruz ki logo degistiginde cikti bozulmasin.
const LOGO_HEIGHT_PX: f64 = 34.0;

/// Sistemin fikir sahibi ve gelistiricisi.
const CONCEPT_NAME: &str = "Ömer Faruk Kaya";
const DEVELOPER_NAME: &str = "Tayyar Akbulut";

/// Rapor metinleri. Panel iki dilli oldugu icin cikti da oyle olmali;
/// yabanci bir muhataba Turkce baslikli tablo gondermek zorunda kalmayalim.
struct Labels {
    title: &'static str,
    period: &'static str,
    company: &'static str,
    all: &'static str,
    generated: &'static str,
    people: &'static str,
    days: &'static str,
    total_work: &'static str,
    unmatched: &'static str,
    sheet: &'static str,
    empty: &'static str,
    concept: &'static str,
    developed: &'static str,
    columns: [(&'static str, f64); 9],
}

const TR: Labels = Labels {
    title: "Personel Takip Sistemi - Puantaj",
    period: "Dönem",
    company: "Firma",
    all: "Tümü",
    generated: "Oluşturma",
    people: "Personel",
    days: "Gün",
    total_work: "Toplam çalışma",
    unmatched: "Eşleşmeyen hareket",
    sheet: "Puantaj",
    empty: "Bu dönemde hareket yok.",
    concept: "Fikir",
    developed: "Geliştiren",
    columns: [
        ("Sicil", 10.0),
        ("Ad Soyad", 26.0),
        ("Firma", 16.0),
        ("Unvan", 18.0),
        ("Tarih", 12.0),
        ("İlk giriş", 10.0),
        ("Son çıkış", 10.0),
        ("Çalışılan", 11.0),
        ("Uyarı", 8.0),
    ],
};

const EN: Labels = Labels {
    title: "Staff Tracking System - Timesheet",
    period: "Period",
    company: "Company",
    all: "All",
    generated: "Generated",
    people: "Staff",
    days: "Days",
    total_work: "Total worked",
    unmatched: "Unmatched events",
    sheet: "Timesheet",
    empty: "No activity in this period.",
    concept: "Concept",
    developed: "Developed by",
    columns: [
        ("Staff no", 10.0),
        ("Name", 26.0),
        ("Company", 16.0),
        ("Title", 18.0),
        ("Date", 12.0),
        ("First in", 10.0),
        ("Last out", 10.0),
        ("Worked", 11.0),
        ("Warning", 8.0),
    ],
};

fn labels(lang: Option<&str>) -> &'static Labels {
    match lang {
        Some("en") => &EN,
        _ => &TR,
    }
}

/// ERN marka yesili.
const ERN: Color = Color::RGB(0x00584E);
const ERN_SOFT: Color = Color::RGB(0xEEF3F2);

pub fn router() -> Router<AppState> {
    Router::new().route("/timesheet.xlsx", get(timesheet))
}

/// Puantaj filtresi + rapor dili.
#[derive(Debug, serde::Deserialize)]
pub struct ReportQuery {
    #[serde(flatten)]
    filter: DailyQuery,
    lang: Option<String>,
}

async fn timesheet(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(req): Query<ReportQuery>,
) -> ApiResult<impl IntoResponse> {
    let q = req.filter;
    let l = labels(req.lang.as_deref());
    let rows = daily_rows(&state, &q).await?;

    let from = q.from.unwrap_or_else(|| Utc::now().date_naive());
    let to = q.to.unwrap_or(from);

    let company = match q.company_id {
        Some(id) => sqlx::query_scalar::<_, String>("SELECT name FROM companies WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?,
        None => None,
    };

    let bytes = build_workbook(&rows, from, to, company.as_deref(), l)
        .map_err(|e| ApiError::Internal(format!("Excel uretilemedi: {e}")))?;

    let filename = format!("puantaj_{from}_{to}.xlsx");

    Ok((
        [
            (
                header::CONTENT_TYPE,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
            ),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
        ],
        bytes,
    ))
}

/// Saat:dakika bicimi. Ondalik saat yerine "8:45" muhasebede daha okunur.
fn hhmm(minutes: i64) -> String {
    format!("{}:{:02}", minutes / 60, minutes % 60)
}

/// UTC damgayi yerel saate cevirip yalnizca saati yazar.
fn clock(value: Option<DateTime<Utc>>) -> String {
    match value {
        Some(v) => {
            let local = v.with_timezone(&Local);
            format!("{:02}:{:02}", local.hour(), local.minute())
        }
        None => "-".to_string(),
    }
}

fn build_workbook(
    rows: &[DailySummary],
    from: NaiveDate,
    to: NaiveDate,
    company: Option<&str>,
    l: &Labels,
) -> Result<Vec<u8>, rust_xlsxwriter::XlsxError> {
    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();
    sheet.set_name(l.sheet)?;

    write_header(sheet, from, to, company, l)?;
    let first_data_row = write_summary(sheet, rows, l)?;
    write_table(sheet, rows, first_data_row, l)?;

    workbook.save_to_buffer()
}

/// Logoyu hedef yukseklige gore olcekler; en-boy orani korunur.
fn scaled_logo(bytes: &[u8]) -> Result<Image, rust_xlsxwriter::XlsxError> {
    let image = Image::new_from_buffer(bytes)?;
    let scale = LOGO_HEIGHT_PX / image.height();
    Ok(image.set_scale_height(scale).set_scale_width(scale))
}

fn write_header(
    sheet: &mut Worksheet,
    from: NaiveDate,
    to: NaiveDate,
    company: Option<&str>,
    l: &Labels,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    sheet.set_row_height(0, 30)?;
    sheet.insert_image(0, 0, &scaled_logo(LOGO_HOLDING)?)?;
    sheet.insert_image(0, 2, &scaled_logo(LOGO_TAAHHUT)?)?;

    let title = Format::new()
        .set_bold()
        .set_font_size(15)
        .set_font_color(ERN)
        .set_align(FormatAlign::Left);
    let subtitle = Format::new().set_font_size(10).set_font_color(Color::Gray);

    sheet.write_with_format(1, 0, l.title, &title)?;

    let range = if from == to {
        format!("{}", from.format("%d.%m.%Y"))
    } else {
        format!("{} - {}", from.format("%d.%m.%Y"), to.format("%d.%m.%Y"))
    };
    sheet.write_with_format(2, 0, format!("{}: {range}", l.period), &subtitle)?;
    sheet.write_with_format(
        3,
        0,
        format!("{}: {}", l.company, company.unwrap_or(l.all)),
        &subtitle,
    )?;

    let now = Local::now();
    sheet.write_with_format(
        3,
        4,
        format!(
            "{}: {:02}.{:02}.{} {:02}:{:02}",
            l.generated,
            now.day(),
            now.month(),
            now.year(),
            now.hour(),
            now.minute()
        ),
        &subtitle,
    )?;

    Ok(())
}

/// Ozet blogu; donen satir numarasi tablonun baslayacagi yer.
fn write_summary(
    sheet: &mut Worksheet,
    rows: &[DailySummary],
    l: &Labels,
) -> Result<u32, rust_xlsxwriter::XlsxError> {
    let label = Format::new()
        .set_bold()
        .set_font_size(9)
        .set_font_color(Color::Gray);
    let value = Format::new()
        .set_bold()
        .set_font_size(13)
        .set_font_color(ERN)
        .set_background_color(ERN_SOFT)
        .set_border(FormatBorder::Thin)
        .set_border_color(Color::RGB(0xDCE8E6))
        .set_align(FormatAlign::Center);

    let total_minutes: i64 = rows.iter().map(|r| r.worked_minutes).sum();
    let unmatched: i64 = rows.iter().map(|r| r.unmatched).sum();

    let mut people: Vec<&str> = rows.iter().map(|r| r.employee_no.as_str()).collect();
    people.sort_unstable();
    people.dedup();

    let mut days: Vec<NaiveDate> = rows.iter().map(|r| r.work_date).collect();
    days.sort_unstable();
    days.dedup();

    let cells = [
        (l.people, people.len().to_string()),
        (l.days, days.len().to_string()),
        (l.total_work, hhmm(total_minutes)),
        (l.unmatched, unmatched.to_string()),
    ];

    for (i, (name, val)) in cells.iter().enumerate() {
        let col = (i * 2) as u16;
        sheet.write_with_format(5, col, *name, &label)?;
        sheet.write_with_format(6, col, val.as_str(), &value)?;
    }

    Ok(9)
}

fn write_table(
    sheet: &mut Worksheet,
    rows: &[DailySummary],
    start: u32,
    l: &Labels,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    let head = Format::new()
        .set_bold()
        .set_font_color(Color::White)
        .set_background_color(ERN)
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_border_color(ERN);

    let cell = Format::new()
        .set_border(FormatBorder::Thin)
        .set_border_color(Color::RGB(0xDCE8E6));
    let cell_center = cell.clone().set_align(FormatAlign::Center);
    let cell_warn = cell
        .clone()
        .set_align(FormatAlign::Center)
        .set_font_color(Color::RGB(0xB45309))
        .set_bold();

    for (i, (name, width)) in l.columns.iter().enumerate() {
        let col = i as u16;
        sheet.write_with_format(start, col, *name, &head)?;
        sheet.set_column_width(col, *width)?;
    }
    sheet.set_row_height(start, 22)?;

    for (i, r) in rows.iter().enumerate() {
        let row = start + 1 + i as u32;
        sheet.write_with_format(row, 0, &r.employee_no, &cell)?;
        sheet.write_with_format(row, 1, &r.full_name, &cell)?;
        sheet.write_with_format(row, 2, r.company_name.as_deref().unwrap_or("-"), &cell)?;
        sheet.write_with_format(row, 3, r.title.as_deref().unwrap_or("-"), &cell)?;
        sheet.write_with_format(
            row,
            4,
            r.work_date.format("%d.%m.%Y").to_string(),
            &cell_center,
        )?;
        sheet.write_with_format(row, 5, clock(r.first_in), &cell_center)?;
        sheet.write_with_format(row, 6, clock(r.last_out), &cell_center)?;
        sheet.write_with_format(row, 7, hhmm(r.worked_minutes), &cell_center)?;

        // Eslesmeyen hareket, o gunun suresinin eksik hesaplandigini gosterir.
        if r.unmatched > 0 {
            sheet.write_with_format(row, 8, r.unmatched.to_string(), &cell_warn)?;
        } else {
            sheet.write_with_format(row, 8, "", &cell_center)?;
        }
    }

    if rows.is_empty() {
        sheet.write_with_format(start + 1, 0, l.empty, &cell)?;
    }

    let credit = Format::new().set_font_size(8).set_font_color(Color::Gray);
    let credit_row = start + rows.len().max(1) as u32 + 2;
    sheet.write_with_format(
        credit_row,
        0,
        format!("{}: {CONCEPT_NAME}", l.concept),
        &credit,
    )?;
    sheet.write_with_format(
        credit_row + 1,
        0,
        format!("{}: {DEVELOPER_NAME}", l.developed),
        &credit,
    )?;

    // Baslik satiri kaydirmada sabit kalsin ve filtre kutulari acilsin.
    sheet.set_freeze_panes(start + 1, 0)?;
    let last_row = start + rows.len().max(1) as u32;
    sheet.autofilter(start, 0, last_row, 8)?;

    Ok(())
}
